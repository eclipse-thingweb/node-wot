import * as TD from '@node-wot/td-tools'
import { Buffer } from 'buffer'
import { ContentCodec } from '@node-wot/core'

const textDecoder = new TextDecoder('utf-8')

export default class WoTFirestoreCodec implements ContentCodec {
  getMediaType(): string {
    return 'application/wotfirestore'
  }

  bytesToValue(
    bytes: Buffer,
    schema: TD.DataSchema,
    parameters: { [key: string]: string }
  ): any {
    let parsed: any
    if (bytes) {
      if (bytes['type'] === 'Buffer' && bytes['data']) {
        parsed = textDecoder.decode(new Uint8Array(bytes['data']))
      } else {
        parsed = bytes.toString()
      }
      if (!schema) return parsed
      if (schema.type === 'boolean') {
        if (parsed === 'true' || parsed === 'false') {
          parsed = JSON.parse(parsed)
        }
        parsed = Boolean(parsed)
      } else if (schema.type === 'number' || schema.type === 'integer') {
        parsed = Number(parsed)
      } else if (schema.type === 'object' || schema.type === 'array') {
        if (parsed === '') {
          parsed = null
        } else {
          parsed = JSON.parse(parsed)
        }
      }
    }
    return parsed
  }

  valueToBytes(
    value: any,
    schema: TD.DataSchema,
    parameters?: { [key: string]: string }
  ): Buffer {
    let body = ''
    if (value !== null && value !== undefined) {
      if (schema && (schema.type === 'object' || schema.type === 'array')) {
        body = JSON.stringify(value)
      } else {
        body = String(value)
      }
    }
    return Buffer.from(body)
  }
}
