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

// TD V1 2016, China, Beijing (https://w3c.github.io/wot/current-practices/wot-practices-beijing-2016.html)
// TD V2 2017, USA, Santa Clara (http://w3c.github.io/wot/current-practices/wot-practices-santa-clara-2017.html)
// TD V3 2017, Germany, Düsseldorf, (http://w3c.github.io/wot/current-practices/wot-practices-duesseldorf-2017.html)

export function transformTDV1StringToV2String(td1: string): Object {
  // create object from original TD and re-arrange data
  let td2 = JSON.parse(td1);

  // TODO the actual modifications
  console.log('NO TD MODIFICATIONS DONE YET!!!!!');

  return td2;
}

export function transformTDV1ObjToV2Obj(td1: Object): Object {
  return transformTDV1StringToV2String(JSON.stringify(td1))
}

export function transformTDV2StringToV1String(td2: string): Object {
  // create object from original TD and re-arrange data
  let td1 = JSON.parse(td2);

  // base to uris
  if (td1['base'] != null) {
    td1['uris'] = []; // new Array();
    td1['uris'].push(td1['base']);
    delete td1['base']; // remove base field
  }

  // split interaction into property, action & event
  if (td1['interactions'] != null && Array.isArray(td1['interactions'])) {
    for (let inter of td1['interactions']) {
      // TODO sanitize @type (remove Property, Action & Event)? Keep it for now. Does not hurt!

      if (inter['@type'] != null && Array.isArray(inter['@type'])) {
        if (inter['@type'].indexOf('Property') >= 0) {
          if (td1['properties'] == null) {
            td1['properties'] = []; // new Array();
          }
          td1['properties'].push(inter);

          // outputData.valueType --> valueType
          if (inter['outputData'] != null && inter['outputData']['valueType'] != null) {
            inter['valueType'] = inter['outputData']['valueType'];
            delete inter['outputData']; // remove outputData field
          }

          // links.href --> hrefs
          // links.mediaType --> encodings
          fixLinksV2toHrefsEncodingsV1(td1, inter);
        }
        if (inter['@type'].indexOf('Action') >= 0) {
          if (td1['actions'] == null) {
            td1['actions'] = []; // new Array();
          }
          td1['actions'].push(inter);

          // inputData and outputData did not change for Action

          // links.href --> hrefs
          // links.mediaType --> encodings
          fixLinksV2toHrefsEncodingsV1(td1, inter);
        }
        if (inter['@type'].indexOf('Event') >= 0) {
          if (td1['events'] == null) {
            td1['events'] = []; // new Array();
          }
          td1['events'].push(inter);

          // outputData.valueType --> valueType
          if (inter['outputData'] != null && inter['outputData']['valueType'] != null) {
            inter['valueType'] = inter['outputData']['valueType'];
            delete inter['outputData']; // remove outputData field
          }

          // links.href --> hrefs
          // links.mediaType --> encodings
          fixLinksV2toHrefsEncodingsV1(td1, inter);
        }
      }
    }
    delete td1['interactions']; // remove interactions field
  }

  // TODO encodings

  return td1;
}

// links.href --> hrefs
// links.mediaType --> encodings
function fixLinksV2toHrefsEncodingsV1(td1: any, inter: any) {
  if (inter['links'] != null && Array.isArray(inter['links'])) {
    for (let link of inter['links']) {
      // hrefs
      if (inter['hrefs'] == null) {
        inter['hrefs'] = []; // new Array();
      }
      inter['hrefs'].push(link['href']);
      // encodings
      if (td1['encodings'] == null) {
        td1['encodings'] = []; // new Array();
      }
      if (td1['encodings'].indexOf(link['mediaType']) < 0) {
        td1['encodings'].push(link['mediaType']);
      }
    }
    delete inter['links']; // remove links field
  }
}

export function transformTDV2ObjToV1Obj(td2: Object): any {
  return transformTDV2StringToV1String(JSON.stringify(td2));
}

export function transformTDV3StringToV1String(td3: string): Object {
  // very similar to TD2-to-TD1 transformation

  // differences to V2
  // * link vs links
  // * interaction vs interactions
  // * "@context" is array
  // * "@type" is array
  // * "outputData" not nested anymore
  // * "inputData" not nested anymore

   // create object from original TD and re-arrange data
  let td1 = JSON.parse(td3);

  // base to uris
  if (td1['base'] != null) {
    td1['uris'] = []; // new Array();
    td1['uris'].push(td1['base']);
    delete td1['base']; // remove base field
  }

  // split interaction into property, action & event
  if (td1['interaction'] != null && Array.isArray(td1['interaction'])) {
    for (let inter of td1['interaction']) {
      // TODO sanitize @type (remove Property, Action & Event)? Keep it for now. Does not hurt!

      if (inter['@type'] != null && Array.isArray(inter['@type'])) {
        if (inter['@type'].indexOf('Property') >= 0) {
          if (td1['properties'] == null) {
            td1['properties'] = []; // new Array();
          }
          td1['properties'].push(inter);

          // outputData --> valueType
          if (inter['outputData'] != null) {
            inter['valueType'] = inter['outputData'];
            delete inter['outputData']; // remove outputData field
          }

          // link.href --> hrefs
          // link.mediaType --> encodings
          fixLinksV3toHrefsEncodingsV1(td1, inter);
        }
        if (inter['@type'].indexOf('Action') >= 0) {
          if (td1['actions'] == null) {
            td1['actions'] = []; // new Array();
          }
          td1['actions'].push(inter);

          // inputData and outputData needs to be nested for Action
          // outputData --> outputData.valueType
          if (inter['outputData'] != null && inter['outputData']['type'] != null) {
            inter['outputData']['valueType'] = {};
            inter['outputData']['valueType']['type']  = inter['outputData']['type'];
            delete inter['outputData']['type']; // remove type field
          }
          if (inter['inputData'] != null && inter['inputData']['type'] != null) {
            inter['inputData']['valueType'] = {};
            inter['inputData']['valueType']['type']  = inter['inputData']['type'];
            delete inter['inputData']['type']; // remove type field
          }

          // link.href --> hrefs
          // link.mediaType --> encodings
          fixLinksV3toHrefsEncodingsV1(td1, inter);
        }
        if (inter['@type'].indexOf('Event') >= 0) {
          if (td1['events'] == null) {
            td1['events'] = []; // new Array();
          }
          td1['events'].push(inter);

          // outputData --> valueType
          if (inter['outputData'] != null) {
            inter['valueType'] = inter['outputData'];
            delete inter['outputData']; // remove outputData field
          }

          // link.href --> hrefs
          // link.mediaType --> encodings
          fixLinksV3toHrefsEncodingsV1(td1, inter);
        }
      }
    }
    delete td1['interaction']; // remove interaction field
  }

  // TODO encodings

  return td1;
}


export function transformTDV3ObjToV1Obj(td3: Object): any {
  return transformTDV3StringToV1String(JSON.stringify(td3));
}


// link.href --> hrefs
// link.mediaType --> encodings
function fixLinksV3toHrefsEncodingsV1(td1: any, inter: any) {
  if (inter['link'] != null && Array.isArray(inter['link'])) {
    for (let link of inter['link']) {
      // hrefs
      if (inter['hrefs'] == null) {
        inter['hrefs'] = []; // new Array();
      }
      inter['hrefs'].push(link['href']);
      // encodings
      if (td1['encodings'] == null) {
        td1['encodings'] = []; // new Array();
      }
      if (td1['encodings'].indexOf(link['mediaType']) < 0) {
        td1['encodings'].push(link['mediaType']);
      }
    }
    delete inter['links']; // remove links field
  }
}