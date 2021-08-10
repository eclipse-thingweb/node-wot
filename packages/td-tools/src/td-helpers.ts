/********************************************************************************
 * Copyright (c) 2018 - 2021 Contributors to the Eclipse Foundation
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
 * Generic TD helper functions used across the code
 * These Helpers are used like this:
 * ```
 * import * as TDHelpers from './td-helpers';
 * ```
 */


import ThingDescription from './thing-description';

/**
 * Find interaction by name
 * @param td ThingDescription instance that keeps the interactions
 * @param name of the interaction which is searched for
 */
/*
export function findInteractionByName(td: ThingDescription, name: string) {
  let res = td.interaction.filter((ia) => ia.name === name)
  return (res.length > 0) ? res[0] : null;
}
*/

/**
 * Find interaction by name AND interaction type
 * @param td ThingDescription instance that keeps the interactions
 * @param name of the interaction which is searched for
 */
/*
export function findInteractionByNameType(td: ThingDescription, name: string, pattern: TD.InteractionPattern) {
  let res = td.interaction.filter((ia) => ia.pattern === pattern && ia.name === name)
  return (res.length > 0) ? res[0] : null;
}
*/

/**
 * Find interaction by semantic characteristics / vocabularies
 * @param td ThingDescription instance that keeps the interactions
 * @param vocabularies list of vocabularies which has to be annotated the resource interacion
 */
/*
export function findInteractionBySemantics(td: ThingDescription, vocabularies: Array<string>) {
  // let res = td.interactions.filter((ia) => ia.rdfType.filter((v)=> v.match(vocabularies)))
  // TODO
  return '';
}
*/

//need two tests
export function findProtocol(td: ThingDescription): string {
	let base: string = td.base;
	let columnLoc: number = base.indexOf(":");
	return base.substring(0, columnLoc);
}

export function findPort(td: ThingDescription): number {
	let base: string = td.base;
	let columnLoc: number = base.indexOf(':', 6);
	let divLoc: number = base.indexOf('/', columnLoc);
	let returnString: string = base.substring(columnLoc + 1, divLoc);
	return parseInt(returnString);
}
