/********************************************************************************
 * Copyright (c) 2018 - 2019 Contributors to the Eclipse Foundation
 * 
 * See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 * 
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0, or the W3C Software Notice and
 * Document License (2015-05-13) which is available at
 * https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document.
 * 
 * SPDX-License-Identifier: EPL-2.0 OR W3C-20150513
 ********************************************************************************/

/**
 * Basic test suite to demonstrate test setup
 * uncomment the @skip to see failing tests
 * 
 * h0ru5: there is currently some problem with VSC failing to recognize experimentalDecorators option, it is present in both tsconfigs
 */

import { suite, test, slow, timeout, skip, only } from "mocha-typescript";
import { expect, should, assert } from "chai";
// should must be called to augment all variables
should();

import Servient from "../src/servient";


@suite("the runtime of servient")
class WoTRuntimeTest {

    static servient: Servient;
    static WoT: WoT.WoT;
    exit: (code?: number) => never;
    
    static before() {
        console.error = () => {}
        this.servient = new Servient();
        console.log("before starting test suite");
    }

    beforeEach(){
        this.exit = process.exit
    }

    afterEach(){
        process.exit = this.exit
    }

    static after() {
        console.log("after finishing test suite");
        this.servient.shutdown();
    }

    @test "should provide cli args"() {

        let envScript = `module.exports = process.argv[0]`;

        const test = WoTRuntimeTest.servient.runPrivilegedScript(envScript, undefined, { argv: ['myArg']})
        assert.equal(test,'myArg')
    }

    @test "should use the compiler function"() {

        let envScript = `this is not js`;

        const test = WoTRuntimeTest.servient.runPrivilegedScript(envScript, undefined, { 
            compiler: ()=>{
                return "module.exports = 'ok'"
            }
        })
        assert.equal(test,'ok')
    }

    @test "should provide env variables"() {

        let envScript = `module.exports = process.env.MY_VAR`;
        process.env;
        const test = WoTRuntimeTest.servient.runPrivilegedScript(envScript, undefined, { env:{'MY_VAR':'test'} })
        assert.equal(test, 'test')
    }
    
    @test "should hide system env variables"() {

        let envScript = `module.exports = process.env.OS`;

        const test = WoTRuntimeTest.servient.runPrivilegedScript(envScript)
        assert.equal(test, undefined)
    }

    @test "should catch synchronous errors"() {

        let failNowScript = `throw new Error("Synchronous error in Servient sandbox");`;

        assert.doesNotThrow( () => { WoTRuntimeTest.servient.runScript(failNowScript); });
        assert.doesNotThrow( () => { WoTRuntimeTest.servient.runPrivilegedScript(failNowScript); });
    }

    @test "should catch bad errors"() {

        let failNowScript = `throw "Bad synchronous error in Servient sandbox";`;

        assert.doesNotThrow( () => { WoTRuntimeTest.servient.runScript(failNowScript); });
        assert.doesNotThrow( () => { WoTRuntimeTest.servient.runPrivilegedScript(failNowScript); });
    }

    @test "should catch asynchronous errors for runScript"(done:any) {
        // Test asynchronous uncaught exceptions is tricky 
        // so here we verify if the exit function is called
        let called = false

        this.mockupProcessExitWithFunction(() => {
            if (!called) {
                done()
                called = true
            }
        });
       
        
        let failThenScript = `setTimeout( () => { throw new Error("Asynchronous error in Servient sandbox"); }, 0);`;

        assert.doesNotThrow( () => { WoTRuntimeTest.servient.runScript(failThenScript); });
    }
    @test "should catch asynchronous errors for runPrivilegedScript"(done:any) {
        let called = false
        
        this.mockupProcessExitWithFunction(() => {
            if(!called){
                done()
                called = true
            }
        });
        
        let failThenScript = `setTimeout( () => { throw new Error("Asynchronous error in Servient sandbox"); }, 0);`;

       assert.doesNotThrow( () => { WoTRuntimeTest.servient.runPrivilegedScript(failThenScript); });
    }

    @test "should catch bad asynchronous errors for runScript"(done:any) {
        // Mocha does not like string errors: https://github.com/trufflesuite/ganache-cli/issues/658
        // so here I am removing its listeners for uncaughtException. 
        // WARNING:  Remove this line as soon the issue is resolved.
        const listeners = this.clearUncaughtListeners()
        let called = false

        this.mockupProcessExitWithFunction(() => {
            if (!called) {
                done()
                this.restoreUncaughtListeners(listeners)
                called = true
            }
        })

        let failThenScript = `setTimeout( () => { throw "Bad asynchronous error in Servient sandbox"; }, 1);`;

        assert.doesNotThrow( () => { WoTRuntimeTest.servient.runScript(failThenScript); });
    }
    @test "should catch bad asynchronous errors  for runPrivilegedScript"(done:any) {
        // Mocha does not like string errors: https://github.com/trufflesuite/ganache-cli/issues/658
        // so here I am removing its listeners for uncaughtException. 
        // WARNING:  Remove this line as soon the issue is resolved.
        const listeners = this.clearUncaughtListeners()
        let called = false
       
        this.mockupProcessExitWithFunction(() => {
            if (!called) {
                done()
                this.restoreUncaughtListeners(listeners)
                called = true
            }
        })

        let failThenScript = `setTimeout( () => { throw "Bad asynchronous error in Servient sandbox"; }, 1);`;
        assert.doesNotThrow( () => { WoTRuntimeTest.servient.runPrivilegedScript(failThenScript); });
    }

    private mockupProcessExitWithFunction(func:Function){
        // @ts-ignore
        process.exit = func
    }

    private clearUncaughtListeners(){
        const listeners = process.listeners("uncaughtException")
        process.removeAllListeners("uncaughtException")
        return listeners;
    }

    private restoreUncaughtListeners(listeners:Array<(...args:any)=>void>){
        listeners.forEach(element => {
            process.on("uncaughtException", element)
        });
    }
}
