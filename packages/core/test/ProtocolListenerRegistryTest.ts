/********************************************************************************
 * Copyright (c) 2022 Contributors to the Eclipse Foundation
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

import { ThingInteraction } from "@node-wot/td-tools";
import { suite, test } from "@testdeck/mocha";
import { expect, should, spy, use as chaiUse } from "chai";
import spies from "chai-spies";
import ProtocolListenerRegistry from "../src/protocol-listener-registry";

chaiUse(spies);
should();

@suite("Protocol Listener Registry test")
class ProtocolListenerRegistryTest {
    static emptyTestAffordance: ThingInteraction = {
        forms: [{ href: "" }, { href: "" }],
    };

    @test "should throw when the form does not exist"() {
        const registry = new ProtocolListenerRegistry();
        const spyListener = spy(() => {
            /** */
        });

        expect(function () {
            registry.register(ProtocolListenerRegistryTest.emptyTestAffordance, 2, spyListener);
        }).to.throw();
    }

    @test "should notify a subscriber"() {
        const registry = new ProtocolListenerRegistry();
        const spyListener = spy(() => {
            /** */
        });

        registry.register(ProtocolListenerRegistryTest.emptyTestAffordance, 0, spyListener);
        registry.notify(ProtocolListenerRegistryTest.emptyTestAffordance, 0);

        spyListener.should.have.been.called();
    }

    @test "should notify exactly one subscriber even with the same affordance structure"() {
        const registry = new ProtocolListenerRegistry();
        const spyListener = spy(() => {
            /** */
        });
        const spyListener2 = spy(() => {
            /** */
        });

        registry.register(ProtocolListenerRegistryTest.emptyTestAffordance, 0, spyListener);
        registry.register(
            {
                forms: [{ href: "" }],
            },
            0,
            spyListener2
        );

        registry.notify(ProtocolListenerRegistryTest.emptyTestAffordance, 0);

        spyListener.should.have.been.called();
        spyListener2.should.not.have.been.called();
    }

    @test "should notify exactly one subscriber with formIndex"() {
        const registry = new ProtocolListenerRegistry();
        const spyListener = spy(() => {
            /** */
        });
        const spyListener2 = spy(() => {
            /** */
        });

        registry.register(ProtocolListenerRegistryTest.emptyTestAffordance, 0, spyListener);
        registry.register(ProtocolListenerRegistryTest.emptyTestAffordance, 1, spyListener2);

        registry.notify(ProtocolListenerRegistryTest.emptyTestAffordance, 0, undefined, 0);

        spyListener.should.have.been.called();
        spyListener2.should.not.have.been.called();
    }

    @test "should notify all subscribers"() {
        const registry = new ProtocolListenerRegistry();
        const spyListener = spy(() => {
            /** */
        });
        const spyListener2 = spy(() => {
            /** */
        });

        registry.register(ProtocolListenerRegistryTest.emptyTestAffordance, 0, spyListener);
        registry.register(ProtocolListenerRegistryTest.emptyTestAffordance, 1, spyListener2);

        registry.notify(ProtocolListenerRegistryTest.emptyTestAffordance, 0);

        spyListener.should.have.been.called();
        spyListener2.should.have.been.called();
    }

    @test "should notify all subscribers when formIndex is not found"() {
        const registry = new ProtocolListenerRegistry();
        const spyListener = spy(() => {
            /** */
        });
        const spyListener2 = spy(() => {
            /** */
        });

        registry.register(ProtocolListenerRegistryTest.emptyTestAffordance, 0, spyListener);
        registry.register(ProtocolListenerRegistryTest.emptyTestAffordance, 1, spyListener2);

        registry.notify(ProtocolListenerRegistryTest.emptyTestAffordance, 0, undefined, 2);

        spyListener.should.have.been.called();
        spyListener2.should.have.been.called();
    }

    @test "should unregister a subscriber"() {
        const registry = new ProtocolListenerRegistry();
        const spyListener = spy(() => {
            /** */
        });
        registry.register(ProtocolListenerRegistryTest.emptyTestAffordance, 0, spyListener);

        registry.unregister(ProtocolListenerRegistryTest.emptyTestAffordance, 0, spyListener);
        registry.notify(ProtocolListenerRegistryTest.emptyTestAffordance, 0);

        spyListener.should.not.have.been.called();
    }

    @test "should throw when unregister a unknown affordance"() {
        const registry = new ProtocolListenerRegistry();
        const spyListener = spy(() => {
            /** */
        });
        registry.register(ProtocolListenerRegistryTest.emptyTestAffordance, 0, spyListener);

        expect(function () {
            registry.unregister(
                {
                    forms: [{ href: "" }],
                },
                0,
                spyListener
            );
        }).to.throw();
    }

    @test "should throw when unregister a unknown index"() {
        const registry = new ProtocolListenerRegistry();
        const spyListener = spy(() => {
            /** */
        });
        registry.register(ProtocolListenerRegistryTest.emptyTestAffordance, 0, spyListener);

        expect(function () {
            registry.unregister(ProtocolListenerRegistryTest.emptyTestAffordance, 1, spyListener);
        }).to.throw();
    }

    @test "should throw when unregister a unknown listener"() {
        const registry = new ProtocolListenerRegistry();
        const spyListener = spy(() => {
            /** */
        });
        registry.register(ProtocolListenerRegistryTest.emptyTestAffordance, 0, spyListener);

        expect(function () {
            registry.unregister(ProtocolListenerRegistryTest.emptyTestAffordance, 0, () => {
                /** */
            });
        }).to.throw();
    }
}
