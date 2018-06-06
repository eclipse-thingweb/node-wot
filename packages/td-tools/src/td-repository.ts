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

import ThingDescription from './thing-description';

/** This enales to discovery and manage TD's that are host in a TD repo */
export default class TDRepository {

  /* uri of the repo */
  private tdRepoURI: string;

  constructor(tdRepoURI: string) {
    this.tdRepoURI = tdRepoURI;
  }

  /** Adds a new TD to a repo
   * @param td TD instance
   * @param tdLifetime how long sold the the TD be saved in the repo
   * @return unique ID token that is provided of the repo to identify uploaded td within the repor
   */
  public addNewTD(td: ThingDescription, tdLifetime: number): string {

    return '';
  }

  /** Delete TD from repo
   * @param ID token that was provided by the TD repo
   * @return sucessful (=true) or not (=false)
   */
  public deleteTD(idTdToken: string): boolean {

    return true;
  }

  /** Check if td is still in repo (useful if you lost the id td token)
   * @param ID token that was provided by the TD repo
   * @return sucessful (=true) or not (=false)
   */
  public checkIfTDisInRepo(td: ThingDescription): string {

    return '';

  }

  /** Simple td search (e.g., provide the name of a Thing or interaction resources)
   * @param query free text search
   * @return return a list of TDs that match the search pattern
   */
  public freeTextSearch(query: string): Array<ThingDescription> {

    return [];
  }

  /** Triple td search
   * @param query SPARQL triple search
   * @return return a list of TDs that match the triple search pattern
   */
  public tripleSearch(query: string): Array<ThingDescription> {

    return [];
  }

}
