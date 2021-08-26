/********************************************************************************
 * Copyright (c) 2020 - 2021 Contributors to the Eclipse Foundation
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

import { ContentSerdes, ContentCodec } from "@node-wot/core";
import * as TD from "@node-wot/td-tools";
import { DataType, Variant, assert } from "node-opcua-client";
import { BinaryStream } from "node-opcua-binary-stream";

/** default implementation offering JSON de-/serialisation */
export default class OpcuaCodec implements ContentCodec {
  getMediaType(): string {
    return 'application/x.opcua-binary'
  }

  bytesToValue(bytes: Buffer, schema: TD.DataSchema, parameters: { [key: string]: string }): any {
    //console.debug(`JsonCodec parsing '${bytes.toString()}'`);
    let parsed: any;
    try {
      parsed = JSON.parse(bytes.toString());
      parsed = parsed.value;
    } catch (err) {
      if (err instanceof SyntaxError) {
        if (bytes.byteLength == 0) {
          // empty payload -> void/undefined
          parsed = undefined;
        } else {
          parsed = (<any>bytes).value; //Variant instance then
        }
      } else {
        throw err;
      }
    }

    // TODO validate using schema

    // remove legacy wrapping and use RFC 7159
    // TODO remove once dropped from all PlugFest implementation
    if (parsed && parsed.value !== undefined) {
      console.warn("[binding-opcua]",`JsonCodec removing { value: ... } wrapper`);
      parsed = parsed.value;
    }
    return parsed;
  }

  valueToBytes(value: any, schema: TD.DataSchema, parameters?: { [key: string]: string }): Buffer {
    //console.debug("JsonCodec serializing", value);
    let body = "";
    if (value !== undefined) {
      let obj: any = {};
      obj.payload = value;

      let className = schema.constructor.name;
      let tmp_schema = <any>schema;
      if (className === 'ConsumedThingProperty') {
        let dataType_string = this.dataTypetoString();
        if (!schema || !tmp_schema[dataType_string] || ((tmp_schema.properties) && !(dataType_string in tmp_schema.properties))) {
          throw new Error(`opc:dataType field not specified for property "${schema.title}"`);
        }
        let dataType = tmp_schema[dataType_string] ? tmp_schema[dataType_string] : tmp_schema.properties[dataType_string];
        dataType = this.getOPCUADataType(dataType);
        obj.dataType = dataType;
      } else if(className === 'ConsumedThingAction') {
        let inputArguments = this.getInputArguments(value, tmp_schema.input);
        obj.inputArguments = inputArguments;
      }
      
      body = JSON.stringify(obj);
    }
    return Buffer.from(body);
  }

  public dataTypetoString() {
    return "opc:dataType";
  }

  private getOPCUADataType(string_type: string) {
    switch (string_type) {
      default:
        console.warn("[binding-opcua]",`dataType "${string_type}" not found, using "Double" as default`)
        return DataType.Double;
      case "Null": return DataType.Null;
      case "Boolean": return DataType.Boolean;
      case "SByte": return DataType.SByte;
      case "Byte": return DataType.Byte;
      case "Int16": return DataType.Int16;
      case "UInt16": return DataType.UInt16;
      case "Int32": return DataType.Int32;
      case "UInt32": return DataType.UInt32;
      case "Int64": return DataType.Int64;
      case "UInt64": return DataType.UInt64;
      case "Float": return DataType.Float;
      case "Double": return DataType.Double;
      case "String": return DataType.String;
      case "DateTime": return DataType.DateTime;
      case "Guid": return DataType.Guid;
      case "ByteString": return DataType.ByteString;
      case "XmlElement": return DataType.XmlElement;
      case "NodeId": return DataType.NodeId;
      case "ExpandedNodeId": return DataType.ExpandedNodeId;
      case "StatusCode": return DataType.StatusCode;
      case "QualifiedName": return DataType.QualifiedName;
      case "LocalizedText": return DataType.LocalizedText;
      case "ExtensionObject": return DataType.ExtensionObject;
      case "DataValue": return DataType.DataValue;
      case "Variant": return DataType.Variant;
      case "DiagnosticInfo": return DataType.DiagnosticInfo;
    }
  }

  private getInputArguments(payload: any, schema?: TD.DataSchema) {

    let inputArguments: any[] = [];
    let tmp_schema = <any>schema;
    if (!tmp_schema) {
      throw new Error("Mandatory \"input\" field missing in the TD");
    }
    if (tmp_schema.type === 'object' && !tmp_schema.properties) {
      throw new Error("Mandatory  \"properties\" field missing in the \"input\"");
    }
    let properties = tmp_schema.properties;
    let dataType_string = this.dataTypetoString();
    if (properties) { //multiple inputs
      for (let key in payload) {
        let tmp_obj: any = {};
        if (!(key in properties) || !(dataType_string in properties[key])) {
          throw new Error(`dataType field not specified for parameter "${key}"`);
        }
        let tmp_dataType = properties[key][dataType_string];
        tmp_obj.dataType = this.getOPCUADataType(tmp_dataType);
        tmp_obj.value = payload[key];
        inputArguments.push(tmp_obj);
      }
    } else { //single input
      if (!(dataType_string in tmp_schema)) {
        throw new Error(`dataType field not specified for input "${payload}"`);
      }
      let tmp_obj: any = {};
      let tmp_dataType = tmp_schema[dataType_string];
      tmp_obj.dataType = this.getOPCUADataType(tmp_dataType)
      tmp_obj.value = payload;
      inputArguments.push(tmp_obj);
    }
    return inputArguments;
  }

}
