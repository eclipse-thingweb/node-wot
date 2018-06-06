/********************************************************************************
 * Copyright (c) 2018 Contributors to the Eclipse Foundation
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

import Thing from './thing-description';
import * as TD from './thing-description';

function stringToThingDescription(tdJson: string): Thing {
  let td: Thing = JSON.parse(tdJson);

  // let tdPlain = JSON.parse(tdJson);
  // let td: Thing = new Thing();
  // TODO "sanitize" Thing class
  if (td["@context"] == undefined) {
    td["@context"] = TD.DEFAULT_HTTPS_CONTEXT;
  }
  if (td.properties != undefined && td.properties instanceof Object) {
    for (var propName in td.properties) {
      let prop = td.properties[propName];
      if (prop.writable == undefined) { // } || prop.writable instanceof Boolean) {
        prop.writable = false;
      }
      if (prop.observable == undefined) { // } || prop.observable instanceof Boolean) {
        prop.observable = false;
      }
    }
  }

  if (typeof td.properties !== 'object' || td.properties === null) {
    td.properties = {};
  }
  if (typeof td.actions !== 'object' || td.actions === null) {
    td.actions = {};
  }
  if (typeof td.events !== 'object' || td.events === null) {
    td.events = {};
  }

  /*
  for (var fieldNameRoot in tdPlain) {
    if (tdPlain.hasOwnProperty(fieldNameRoot)) {
      switch (fieldNameRoot) {
        case "@context":
          if (typeof tdPlain[fieldNameRoot] === "string" && (
            tdPlain[fieldNameRoot] === TD.DEFAULT_HTTP_CONTEXT ||
            tdPlain[fieldNameRoot] === TD.DEFAULT_HTTPS_CONTEXT
          )) {
            // default set in constructor already
          } else if (Array.isArray(tdPlain[fieldNameRoot])) {
            for (let contextEntry of tdPlain[fieldNameRoot]) {
              if (typeof contextEntry === "string" && (
                contextEntry === TD.DEFAULT_HTTP_CONTEXT ||
                contextEntry === TD.DEFAULT_HTTPS_CONTEXT
              )) {
                // default set in constructor already
              } else if (typeof contextEntry === "string") {
                td.context.push(contextEntry);
              } else if (typeof contextEntry === "object") {
                td.context.push(contextEntry);
              } else {
                console.error("@context field entry of array of unknown type");
              }
            }
          } else {
            console.error("@context field neither of type array nor string");
          }
          break;
        case "@type":
          if (typeof tdPlain[fieldNameRoot] === "string" && tdPlain[fieldNameRoot] === TD.DEFAULT_THING_TYPE) {
            // default, additional @types to "Thing" only
          } else if (Array.isArray(tdPlain[fieldNameRoot])) {
            for (let typeEntry of tdPlain[fieldNameRoot]) {
              if (typeof typeEntry === "string") {
                if (typeEntry === TD.DEFAULT_THING_TYPE) {
                  // default, additional @types to "Thing" only
                } else {
                  let st: WoT.SemanticType = {
                    name: typeEntry,
                    context: "TODO"
                    // ,
                    // prefix: "p"
                  };
                  td.semanticType.push(st);
                }
              }
            }
          } else {
            console.error("@type field neither of type array nor string");
          }
          break;
        case "name":
          if (typeof tdPlain[fieldNameRoot] === "string") {
            td.name = tdPlain[fieldNameRoot];
          } else {
            console.error("name field not of type string");
          }
          break;
        case "@id":
          if (typeof tdPlain[fieldNameRoot] === "string") {
            td.id = tdPlain[fieldNameRoot];
          } else {
            console.error("@id field not of type string");
          }
          break;
        case "base":
          if (typeof tdPlain[fieldNameRoot] === "string") {
            td.base = tdPlain[fieldNameRoot];
          } else {
            console.error("base field not of type string");
          }
          break;
        case "security":
          td.security = tdPlain[fieldNameRoot];
          break;
        case "interaction":
          if (Array.isArray(tdPlain[fieldNameRoot])) {
            for (let interactionEntry of tdPlain[fieldNameRoot]) {
              if (typeof interactionEntry === "object") {
                let inter = new TD.Interaction();
                td.interaction.push(inter);
                for (var fieldNameInteraction in interactionEntry) {
                  if (interactionEntry.hasOwnProperty(fieldNameInteraction)) {
                    switch (fieldNameInteraction) {
                      case "name":
                        if (typeof interactionEntry[fieldNameInteraction] === "string") {
                          inter.name = interactionEntry[fieldNameInteraction];
                        } else {
                          console.error("name field of interaction not of type string");
                        }
                        break;
                      case "@type":
                        if (typeof interactionEntry[fieldNameInteraction] === "string") {
                          inter.semanticType.push(interactionEntry[fieldNameInteraction]);
                        } else if (Array.isArray(interactionEntry[fieldNameInteraction])) {
                          for (let typeInteractionEntry of interactionEntry[fieldNameInteraction]) {
                            if (typeof typeInteractionEntry === "string") {
                              inter.semanticType.push(typeInteractionEntry);
                            } else {
                              console.error("interaction @type field not of type string");
                            }
                          }
                        } else {
                          console.error("@type field of interaction neither of type array nor string");
                        }
                        break;
                      case "schema":
                        inter.schema = interactionEntry[fieldNameInteraction];
                        break;
                      case "inputSchema":
                        inter.inputSchema = interactionEntry[fieldNameInteraction];
                        break;
                      case "outputSchema":
                        inter.outputSchema = interactionEntry[fieldNameInteraction];
                        break;
                      case "writable":
                        if (typeof interactionEntry[fieldNameInteraction] === "boolean") {
                          inter.writable = interactionEntry[fieldNameInteraction];
                        } else {
                          console.error("writable field of interaction not of type boolean");
                        }
                        break;
                      case "observable":
                        if (typeof interactionEntry[fieldNameInteraction] === "boolean") {
                          inter.observable = interactionEntry[fieldNameInteraction];
                        } else {
                          console.error("observable field of interaction not of type boolean");
                        }
                        break;
                      case "link": // link replaced by form
                      case "form":
                        // InteractionForm
                        if (Array.isArray(interactionEntry[fieldNameInteraction])) {
                          for (let formInteractionEntry of interactionEntry[fieldNameInteraction]) {
                            if (typeof formInteractionEntry === "object") {
                              let form = new TD.InteractionForm();
                              inter.form.push(form);
                              for (var fieldNameForm in formInteractionEntry) {
                                if (formInteractionEntry.hasOwnProperty(fieldNameForm)) {
                                  switch (fieldNameForm) {
                                    case "href":
                                      if (typeof formInteractionEntry[fieldNameForm] === "string") {
                                        form.href = formInteractionEntry[fieldNameForm];
                                      } else {
                                        console.error("interaction form href field entry not of type string");
                                      }
                                      break;
                                    case "mediaType":
                                      if (typeof formInteractionEntry[fieldNameForm] === "string") {
                                        form.mediaType = formInteractionEntry[fieldNameForm];
                                      } else {
                                        console.error("interaction form mediaType field entry not of type string");
                                      }
                                      break;
                                    default:
                                      break;
                                  }
                                }
                              }
                            } else {
                              console.error("interaction form field entry not of type object");
                            }
                          }
                        } else {
                          console.error("form field of interaction not of type array");
                        }
                        break;
                      default: // metadata
                        // TODO prefix/context parsing metadata
                        let md: WoT.SemanticMetadata = {
                          type: {
                            name: fieldNameInteraction,
                            context: "TODO"
                            // ,
                            // prefix: "p" 
                          },
                          value: interactionEntry[fieldNameInteraction]
                        };
                        inter.metadata.push(md);
                        break;
                    }
                  }
                }
              } else {
                console.error("interactionEntry field not of type object");
              }
            }
          } else {
            console.error("interaction field not of type array");
          }
          break;
        case "link":
          td.link = tdPlain[fieldNameRoot];
          break;
        default: // metadata
          // TODO prefix/context parsing metadata
          let md: WoT.SemanticMetadata = {
            type: {
              name: fieldNameRoot,
              context: "TODO"
              // ,
              // prefix: "p" 
            },
            value: tdPlain[fieldNameRoot]
          };
          td.metadata.push(md);
          break;
      }
    }
  }
  */

  return td;
}

function thingDescriptionToString(td: Thing): string {
  return JSON.stringify(td);

  /*
  let json: any = {};
  // @context
  json["@context"] = td.context;
  // @type + "Thing"
  json["@type"] = [TD.DEFAULT_THING_TYPE];
  for (let semType of td.semanticType) {
    json["@type"].push((semType.prefix ? semType.prefix + ":" : "") + semType.name);
  }
  // name and id
  json.name = td.name;
  json["@id"] = td.id;
  // base
  json.base = td.base;
  // metadata
  for (let md of td.metadata) {
    // TODO align with parsing method
    json[md.type.name] = md.value;
  }
  // security
  json.security = td.security;
  // interaction
  json.interaction = [];
  for (let inter of td.interaction) {
    let jsonInter: any = {};
    // name
    jsonInter.name = inter.name;
    // @type and Interaction-specific metadata
    if (inter.pattern == TD.InteractionPattern.Property) {
      jsonInter["@type"] = ["Property"];
      // schema
      if (inter.schema) {
        jsonInter.schema = inter.schema;
      }
      // writable
      if(inter.writable == true) {
        jsonInter.writable = inter.writable;
      } else {
        jsonInter.writable = false;
      }
      // observable
      if(inter.observable == true) {
        jsonInter.observable = inter.observable;
      } else {
        jsonInter.observable = false;
      }
    } else if (inter.pattern == TD.InteractionPattern.Action) {
      jsonInter["@type"] = ["Action"];
      // schema
      if (inter.inputSchema) {
        jsonInter.inputSchema = inter.inputSchema;
      }
      if (inter.outputSchema) {
        jsonInter.outputSchema = inter.outputSchema;
      }
    } else if (inter.pattern == TD.InteractionPattern.Event) {
      jsonInter["@type"] = ["Event"];
      // schema
      if (inter.schema) {
        jsonInter.schema = inter.schema;
      }
    }
    for (let semType of inter.semanticType) {
      //if(semType != "Property" && semType != "Action" && semType != "Event") {
      jsonInter["@type"].push(semType);
      //}
    }
    // form
    jsonInter.form = [];
    for (let form of inter.form) {
      let jsonForm: any = {};
      if (form.href) {
        jsonForm.href = form.href;
      } else {
        console.error(`No href for '${td.name}' ${inter.pattern} '${inter.name}'`);
      }
      if (form.mediaType) {
        jsonForm.mediaType = form.mediaType;
      } else {
        jsonForm.mediaType = "application/json";
      }
      jsonInter.form.push(jsonForm);
    }
    // metadata
    for (let md of inter.metadata) {
      // TODO align with parsing method
      jsonInter[md.type.name] = md.value;
    }
    json.interaction.push(jsonInter);
  }
  if (td.link.length > 0) {
    json.link = td.link;
  }
  return JSON.stringify(json);
  */
}

export function parseTDString(json: string, normalize?: boolean): Thing {
  console.debug(`parseTDString() parsing\n\`\`\`\n${json}\n\`\`\``);
  let td: Thing = stringToThingDescription(json);

  if (td.security) console.log(`parseTDString() found security metadata`);

  // TODO normalize normalize each Interaction link
  return td;

  /*
  console.debug(`parseTDString() found ${td.interaction.length} Interaction${td.interaction.length === 1 ? '' : 's'}`);
  // for each interaction assign the Interaction type (Property, Action, Event)
  // and, if "base" is given, normalize each Interaction link
  for (let interaction of td.interaction) {
    // moving Interaction Pattern information to 'pattern' field
    let indexProperty = interaction.semanticType.indexOf(TD.InteractionPattern.Property.toString());
    let indexAction = interaction.semanticType.indexOf(TD.InteractionPattern.Action.toString());
    let indexEvent = interaction.semanticType.indexOf(TD.InteractionPattern.Event.toString());
    if (indexProperty !== -1) {
      console.debug(` * Property '${interaction.name}'`);
      interaction.pattern = TD.InteractionPattern.Property;
      interaction.semanticType.splice(indexProperty, 1);
    } else if (indexAction !== -1) {
      console.debug(` * Action '${interaction.name}'`);
      interaction.pattern = TD.InteractionPattern.Action;
      interaction.semanticType.splice(indexAction, 1);
    } else if (indexEvent !== -1) {
      console.debug(` * Event '${interaction.name}'`);
      interaction.pattern = TD.InteractionPattern.Event;
      interaction.semanticType.splice(indexEvent, 1);
    } else {
      console.error(`parseTDString() found no Interaction pattern`);
    }
    if (normalize == null || normalize) {
      // if a base uri is used normalize all relative hrefs in links
      if (td.base !== undefined) {
        let url = require('url');
        for (let form of interaction.form) {
          console.debug(`parseTDString() applying base '${td.base}' to '${form.href}'`);
          let href: string = form.href;
          // url modul works only for http --> so replace any protocol to
          //    http and after resolving replace orign protocol back
          let n: number = td.base.indexOf(':');
          let scheme: string = td.base.substr(0, n + 1); // save origin protocol
          let uriTemp: string = td.base.replace(scheme, 'http:'); // replace protocol
          uriTemp = url.resolve(uriTemp, href) // URL resolving
          uriTemp = uriTemp.replace('http:', scheme); // replace protocol back to origin
          form.href = uriTemp;
        }
      }
    }
  }
  return td;
  */
}

export function serializeTD(td: Thing): string {

  let json: string = thingDescriptionToString(td);

  console.debug(`serializeTD() produced\n\`\`\`\n${json}\n\`\`\``);

  return json;
}
