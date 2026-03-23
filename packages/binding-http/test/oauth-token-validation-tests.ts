/********************************************************************************
 * Copyright (c) 2020 Contributors to the Eclipse Foundation
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

import { suite, test } from "@testdeck/mocha";
import express from "express";
import { should } from "chai";
import create, { IntrospectionEndpoint, Validator, EndpointValidator } from "../src/oauth-token-validation";
import * as http from "http";
import * as https from "https";
import * as fs from "fs";
import { assert } from "console";
import { promisify } from "util";

should();

describe("OAuth2.0 Validator tests", () => {
    it("should create an introspection validator", () => {
        const config: IntrospectionEndpoint = {
            name: "introspection_endpoint",
            endpoint: "http://localhost:7777",
        };
        create(config).should.be.instanceOf(EndpointValidator);
    });

    it("should throw for invalid method", () => {
        const test = () => create({ name: "unknown" });

        test.should.throw();
    });
    @suite
    class IntrospectProtocolTests {
        private validator!: Validator;
        static server: http.Server;
        static before() {
            const tokens = ["active", "noScopes", "notActive"];

            const introspectEndpoint: express.Express = express();
            introspectEndpoint.use(express.urlencoded({ extended: true }));

            introspectEndpoint.use("/invalid", (req, res) => {
                return res.status(400).end();
            });

            introspectEndpoint.use("/invalidResponse", (req, res) => {
                return res
                    .status(200)
                    .json({
                        scope: "1 2",
                        client_id: "coolClient",
                    })
                    .end();
            });

            introspectEndpoint.use("/invalidContent", (req, res) => {
                return res.status(200).end();
            });

            introspectEndpoint.use((req, res) => {
                if (req.method !== "POST" || req.is("application/x-www-form-urlencoded") == null) {
                    return res.status(400).end();
                }

                const token = req.body.token;

                if (token == null) {
                    return res.status(400).end();
                }
                switch (token) {
                    case tokens[0]:
                        return res
                            .status(200)
                            .json({
                                active: true,
                                scope: "1 2",
                                client_id: "coolClient",
                            })
                            .end();
                    case tokens[1]:
                        return res
                            .status(200)
                            .json({
                                active: true,
                                client_id: "coolClient",
                            })
                            .end();
                    default:
                        return res
                            .status(200)
                            .json({
                                active: false,
                            })
                            .end();
                }
            });

            this.server = introspectEndpoint.listen(7777);
        }

        static after() {
            return promisify(this.server.close.bind(this.server))();
        }

        before() {
            const config: IntrospectionEndpoint = {
                name: "introspection_endpoint",
                endpoint: "http://localhost:7777",
            };
            this.validator = create(config);
        }

        @test async "should validate token from headers"() {
            const req = {
                headers: {
                    authorization: "Bearer active",
                },
                url: "http://test",
            };

            const valid = await this.validator.validate(req as http.IncomingMessage, ["1", "2"], /.*/g);
            valid.should.eql(true);
        }

        @test async "should validate token from query string"() {
            const req = {
                headers: {},
                url: "http://test?access_token=active",
            };

            const valid = await this.validator.validate(req as http.IncomingMessage, ["1", "2"], /.*/g);
            valid.should.eql(true);
        }

        @test async "should validate a single scope"() {
            const req = {
                headers: {},
                url: "http://test?access_token=active",
            };

            const valid = await this.validator.validate(req as http.IncomingMessage, ["1"], /.*/g);
            valid.should.eql(true);
        }

        @test async "should validate a single scope mixed with invalid scopes"() {
            const req = {
                headers: {},
                url: "http://test?access_token=active",
            };

            const valid = await this.validator.validate(req as http.IncomingMessage, ["1", "3", "4"], /.*/g);
            valid.should.eql(true);
        }

        @test async "should validate if no scopes are required"() {
            const req = {
                headers: {},
                url: "http://test?access_token=active",
            };

            const valid = await this.validator.validate(req as http.IncomingMessage, [], /.*/g);
            valid.should.eql(true);
        }

        @test async "should validate if no scopes are required and no scopes are returned"() {
            const req = {
                headers: {},
                url: "http://test?access_token=noScopes",
            };

            const valid = await this.validator.validate(req as http.IncomingMessage, [], /.*/g);
            valid.should.eql(true);
        }

        @test async "should validate clientId"() {
            const req = {
                headers: {},
                url: "http://test?access_token=active",
            };

            const valid = await this.validator.validate(req as http.IncomingMessage, ["1", "3", "4"], /coolClient/g);
            valid.should.eql(true);
        }

        @test async "should validate clientId using regex"() {
            const req = {
                headers: {},
                url: "http://test?access_token=active",
            };

            const valid = await this.validator.validate(req as http.IncomingMessage, ["1", "3", "4"], /cool.*/g);
            valid.should.eql(true);
        }

        @test async "should reject invalid clientId"() {
            const req = {
                headers: {},
                url: "http://test?access_token=active",
            };

            const valid = await this.validator.validate(req as http.IncomingMessage, ["1", "3", "4"], /otherClient/g);
            valid.should.eql(false);
        }

        @test async "should reject invalid scopes"() {
            const req = {
                headers: {},
                url: "http://test?access_token=active",
            };

            const valid = await this.validator.validate(req as http.IncomingMessage, ["3"], /.*/g);
            valid.should.eql(false);
        }

        @test async "should reject invalid token from headers"() {
            const req = {
                headers: {
                    authorization: "Bearer notActive",
                },
                url: "http://test",
            };

            const valid = await this.validator.validate(req as http.IncomingMessage, [], /.*/g);
            valid.should.eql(false);
        }

        @test async "should reject if no scopes are returned"() {
            const req = {
                headers: {
                    authorization: "Bearer noScopes",
                },
                url: "http://test",
            };

            const valid = await this.validator.validate(req as http.IncomingMessage, ["1", "2"], /.*/g);
            valid.should.eql(false);
        }

        @test async "should reject invalid token from query string"() {
            const req = {
                headers: {},
                url: "http://test?access_token=notActive",
            };

            const valid = await this.validator.validate(req as http.IncomingMessage, [], /.*/g);
            valid.should.eql(false);
        }

        @test async "should throw invalid incoming message"() {
            const req = {
                headers: {},
                url: "http://test",
            };

            try {
                await this.validator.validate(req as http.IncomingMessage, [], /.*/g);
                assert(false, "method did not throw");
            } catch {
                assert(true);
            }
        }

        @test async "should throw invalid introspection http response"() {
            const config: IntrospectionEndpoint = {
                name: "introspection_endpoint",
                endpoint: "http://localhost:7777/invalid",
            };
            this.validator = create(config);

            const req = {
                headers: {
                    authorization: "Bearer active",
                },
                url: "http://test",
            };

            try {
                await this.validator.validate(req as http.IncomingMessage, [], /.*/g);
                assert(false, "method did not throw");
            } catch {
                assert(true);
            }
        }

        @test async "should throw invalid introspection token response"() {
            const config: IntrospectionEndpoint = {
                name: "introspection_endpoint",
                endpoint: "http://localhost:7777/invalidResponse",
            };
            this.validator = create(config);

            const req = {
                headers: {
                    authorization: "Bearer active",
                },
                url: "http://test",
            };

            try {
                await this.validator.validate(req as http.IncomingMessage, [], /.*/g);
                assert(false, "method did not throw");
            } catch {
                assert(true);
            }
        }

        @test async "should throw invalid introspection content type response"() {
            const config: IntrospectionEndpoint = {
                name: "introspection_endpoint",
                endpoint: "http://localhost:7777/invalidContent",
            };
            this.validator = create(config);

            const req = {
                headers: {
                    authorization: "Bearer active",
                },
                url: "http://test",
            };

            try {
                await this.validator.validate(req as http.IncomingMessage, [], /.*/g);
                assert(false, "method did not throw");
            } catch {
                assert(true);
            }
        }

        @test async "should connect using https"() {
            // Initialize test

            const introspectEndpoint: express.Express = express();
            introspectEndpoint.use(express.urlencoded({ extended: true }));

            introspectEndpoint.use((req, res) => {
                // No validation just testing https connection
                return res
                    .status(200)
                    .json({
                        active: true,
                        scope: "1 2",
                        client_id: "coolClient",
                    })
                    .end();
            });

            const server = https.createServer(
                {
                    key: fs.readFileSync("./test/server.key"),
                    cert: fs.readFileSync("./test/server.cert"),
                },
                introspectEndpoint
            );
            const serverStarted = new Promise<void>((resolve, reject) => {
                server.listen(7778, resolve); // might need to check if there was an error
            });
            await serverStarted;

            const config: IntrospectionEndpoint = {
                name: "introspection_endpoint",
                endpoint: "https://localhost:7778",
                allowSelfSigned: true,
            };
            this.validator = create(config);

            const req = {
                headers: {
                    authorization: "Bearer active",
                },
                url: "http://test",
            };

            // test
            const valid = await this.validator.validate(req as http.IncomingMessage, ["1"], /.*/g);
            valid.should.eql(true);
            await promisify(server.close.bind(server))();
        }
    }
});
