import { suite, test, slow, timeout } from 'mocha-typescript';
import * as express from 'express';
import { should } from "chai";
import create, { IntrospectionEndpoint, Validator, EndpointValidator } from '../src/oauth-token-validation'
import * as http from "http";
import * as https from "https";
import * as fs from 'fs';
import { assert } from 'console';


should()

describe('OAuth2.0 Validator tests', () => {
    it('should create an introspection validator', () => {
        const config: IntrospectionEndpoint = {
            name: "introspection_endpoint",
            endpoint: "http://localhost:7777"
        }
        create(config).should.be.instanceOf(EndpointValidator)
    });

    it('should throw for invalid method', () => {
        
        const test = () => create({name : "unknown" })

        test.should.throw()
    });
    @suite class IntrospectProtocolTests {
        private validator: Validator;
        static before() {
            console.debug = () => { }
            console.warn = () => { }
            console.info = () => { }

            const tokens = ["active","notActive"];

            var introspectEndpoint: express.Express = express();
            introspectEndpoint.use(express.urlencoded({extended: true}))
            
            introspectEndpoint.use("/invalid",(req,res)=>{
                return res.status(400).end()
            })

            introspectEndpoint.use("/invalidResponse",(req,res)=>{
                return res.status(200).json({
                    scope: "1 2",
                    client_id: "coolClient"
                }).end()
            })

            introspectEndpoint.use("/invalidContent",(req,res)=>{
                return res.status(200).end()
            })

            introspectEndpoint.use((req,res) => {
                if (req.method !== "POST" || !req.is("application/x-www-form-urlencoded")){
                    return res.status(400).end()
                }
                
                const token = req.body.token

                if(!token){
                    return res.status(400).end()
                }

                if(token === tokens[0]){
                    return res.status(200).json({
                        active: true,
                        scope: "1 2",
                        client_id: "coolClient"
                    }).end()
                }else{
                    return res.status(200).json({
                        active: false
                    }).end()
                }
            })

            introspectEndpoint.listen(7777)

        }

        before(){
            const config: IntrospectionEndpoint = {
                name: "introspection_endpoint",
                endpoint: "http://localhost:7777"
            }
            this.validator = create(config)
        }
        
        @test async "should validate token from headers"() {

            var req ={
                headers: {
                    'authorization': 'Bearer active'
                },
                url : "http://test"
            };
            
            const valid = await this.validator.validate(req as http.IncomingMessage,["1","2"],/.*/g)
            valid.should.be.true
        }
        @test async "should validate token from query string"() {

            var req ={
                headers:{},
                url : "http://test?access_token=active"
            };
            
            const valid = await this.validator.validate(req as http.IncomingMessage,["1","2"],/.*/g)
            valid.should.be.true
        }

        @test async "should validate a single scope"() {

            var req ={
                headers:{},
                url : "http://test?access_token=active"
            };
            
            const valid = await this.validator.validate(req as http.IncomingMessage,["1"],/.*/g)
            valid.should.be.true
        }

        @test async "should validate a single scope mixed with invalid scopes"() {

            var req ={
                headers:{},
                url : "http://test?access_token=active"
            };
            
            const valid = await this.validator.validate(req as http.IncomingMessage,["1","3","4"],/.*/g)
            valid.should.be.true
        }

        @test async "should validate cliedId"() {

            var req ={
                headers:{},
                url : "http://test?access_token=active"
            };
            
            const valid = await this.validator.validate(req as http.IncomingMessage,["1","3","4"],/coolClient/g)
            valid.should.be.true
        }

        @test async "should validate cliedId using regex"() {

            var req ={
                headers:{},
                url : "http://test?access_token=active"
            };
            
            const valid = await this.validator.validate(req as http.IncomingMessage,["1","3","4"],/cool.*/g)
            valid.should.be.true
        }

        @test async "should reject invalid cliedId"() {

            var req ={
                headers:{},
                url : "http://test?access_token=active"
            };
            
            const valid = await this.validator.validate(req as http.IncomingMessage,["1","3","4"],/otherClient/g)
            valid.should.be.false
        }
        @test async "should reject invalid scopes"() {

            var req ={
                headers:{},
                url : "http://test?access_token=active"
            };
            
            const valid = await this.validator.validate(req as http.IncomingMessage,["3"],/.*/g)
            valid.should.be.false
        }
        @test async "should reject invalid token from headers"() {

            var req ={
                headers: {
                    'authorization': 'Bearer notActive'
                },
                url : "http://test"
            };
            
            const valid = await this.validator.validate(req as http.IncomingMessage,[],/.*/g)
            valid.should.be.false
        }

        @test async "should reject invalid token from query string"() {

            var req = {
                headers: {},
                url: "http://test?access_token=notActive"
            };

            const valid = await this.validator.validate(req as http.IncomingMessage, [], /.*/g)
            valid.should.be.false
        }

        @test async "should throw invalid incoming message"() {

            var req = {
                headers: {},
                url: "http://test"
            };

            try {
                const valid = await this.validator.validate(req as http.IncomingMessage, [], /.*/g)
                assert(false,"method did not throw")
            } catch (error) {
                assert(true)
            }
        }
        @test async "should throw invalid introspection http response"() {
            const config: IntrospectionEndpoint = {
                name: "introspection_endpoint",
                endpoint: "http://localhost:7777/invalid"
            }
            this.validator = create(config)

            var req = {
                headers: {
                    'authorization': 'Bearer active'
                },
                url: "http://test"
            };

            try {
                const valid = await this.validator.validate(req as http.IncomingMessage, [], /.*/g)
                assert(false,"method did not throw")
            } catch (error) {
                assert(true)
            }
        }

        @test async "should throw invalid introspection token response"() {
            const config: IntrospectionEndpoint = {
                name: "introspection_endpoint",
                endpoint: "http://localhost:7777/invalidResponse"
            }
            this.validator = create(config)

            var req = {
                headers: {
                    'authorization': 'Bearer active'
                },
                url: "http://test"
            };

            try {
                const valid = await this.validator.validate(req as http.IncomingMessage, [], /.*/g)
                assert(false,"method did not throw")
            } catch (error) {
                assert(true)
            }
        }

        @test async "should throw invalid introspection content type response"() {
            const config: IntrospectionEndpoint = {
                name: "introspection_endpoint",
                endpoint: "http://localhost:7777/invalidContent"
            }
            this.validator = create(config)

            var req = {
                headers: {
                    'authorization': 'Bearer active'
                },
                url: "http://test"
            };

            try {
                const valid = await this.validator.validate(req as http.IncomingMessage, [], /.*/g)
                assert(false,"method did not throw")
            } catch (error) {
                assert(true)
            }
        }

        @test async "should connect using https"() {

            //Initialize test

            var introspectEndpoint: express.Express = express();
            introspectEndpoint.use(express.urlencoded({extended:true}))
            
            introspectEndpoint.use((req, res) =>{
                // No validation just testing https connection
                return res.status(200).json({
                    active: true,
                    scope: "1 2",
                    client_id: "coolClient"
                }).end() 
            })

            https.createServer({
                key: fs.readFileSync('./test/server.key'),
                cert: fs.readFileSync('./test/server.cert')
            }, introspectEndpoint).listen(7778, "localhost")  

            const config: IntrospectionEndpoint = {
                name: "introspection_endpoint",
                endpoint: "https://localhost:7778",
                allowSelfSigned: true
            }
            this.validator = create(config)

            var req = {
                headers: {
                    'authorization': 'Bearer active'
                },
                url: "http://test"
            };

            //test
            const valid = await this.validator.validate(req as http.IncomingMessage, ["1"], /.*/g)
            valid.should.be.true
           
        }


    }
});

