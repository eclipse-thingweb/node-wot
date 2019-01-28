/// <reference types="node" />

import * as events from 'events'
import {
  IClientOptions,
  IClientPublishOptions,
  IClientSubscribeOptions,
  IClientReconnectOptions
} from './client-options'
import { Store } from './store'
import { Packet, QoS } from 'mqtt-packet'

export interface ISubscriptionGrant {
  /**
   *  is a subscribed to topic
   */
  topic: string
  /**
   *  is the granted qos level on it, may return 128 on error
   */
  qos: QoS | number
  /*
  * no local flag
  * */
  nl?: boolean,
  /*
  * Retain As Published flag
  * */
  rap?: boolean,
  /*
  * Retain Handling option
  * */
  rh?: number
}
export interface ISubscriptionRequest {
  /**
   *  is a subscribed to topic
   */
  topic: string
  /**
   *  is the granted qos level on it
   */
  qos: QoS
  /*
  * no local flag
  * */
  nl?: boolean,
  /*
  * Retain As Published flag
  * */
  rap?: boolean,
  /*
  * Retain Handling option
  * */
  rh?: number
}
export interface ISubscriptionMap {
  /**
   * object which has topic names as object keys and as value the options, like {'test1': {qos: 0}, 'test2': {qos: 2}}.
   */
  [topic: string]: {
    qos: QoS,
    nl?: boolean,
    rap?: boolean,
    rh?: number
  }
}

export declare type ClientSubscribeCallback = (err: Error, granted: ISubscriptionGrant[]) => void
export declare type OnMessageCallback = (topic: string, payload: Buffer, packet: Packet) => void
export declare type OnPacketCallback = (packet: Packet) => void
export declare type OnErrorCallback = (error: Error) => void
export declare type PacketCallback = (error?: Error, packet?: Packet) => any
export declare type CloseCallback = () => void

export interface IStream extends events.EventEmitter {
  pipe (to: any): any
  destroy (): any
  end (): any
}
/**
 * MqttClient constructor
 *
 * @param {Stream} stream - stream
 * @param {Object} [options] - connection options
 * (see Connection#connect)
 */
export declare class MqttClient extends events.EventEmitter {
  public connected: boolean
  public disconnecting: boolean
  public disconnected: boolean
  public reconnecting: boolean
  public incomingStore: Store
  public outgoingStore: Store
  public options: IClientOptions
  public queueQoSZero: boolean

  constructor (streamBuilder: (client: MqttClient) => IStream, options: IClientOptions)

  public on (event: 'message', cb: OnMessageCallback): this
  public on (event: 'packetsend' | 'packetreceive', cb: OnPacketCallback): this
  public on (event: 'error', cb: OnErrorCallback): this
  public on (event: string, cb: Function): this

  public once (event: 'message', cb: OnMessageCallback): this
  public once (event:
                'packetsend'
                | 'packetreceive', cb: OnPacketCallback): this
  public once (event: 'error', cb: OnErrorCallback): this
  public once (event: string, cb: Function): this

  /**
   * publish - publish <message> to <topic>
   *
   * @param {String} topic - topic to publish to
   * @param {(String|Buffer)} message - message to publish
   *
   * @param {Object}    [opts] - publish options, includes:
   *   @param {Number}  [opts.qos] - qos level to publish on
   *   @param {Boolean} [opts.retain] - whether or not to retain the message
   *   @param {Function}[opts.cbStorePut] - function(){}
   *       called when message is put into `outgoingStore`
   *
   * @param {Function} [callback] - function(err){}
   *    called when publish succeeds or fails
   *
   * @returns {Client} this - for chaining
   * @api public
   *
   * @example client.publish('topic', 'message')
   * @example
   *     client.publish('topic', 'message', {qos: 1, retain: true})
   * @example client.publish('topic', 'message', console.log)
   */
  public publish (topic: string, message: string | Buffer,
                 opts: IClientPublishOptions, callback?: PacketCallback): this
  public publish (topic: string, message: string | Buffer,
                 callback?: PacketCallback): this

  /**
   * subscribe - subscribe to <topic>
   *
   * @param {String, Array, Object} topic - topic(s) to subscribe to, supports objects in the form {'topic': qos}
   * @param {Object} [opts] - optional subscription options, includes:
   * @param  {Number} [opts.qos] - subscribe qos level
   * @param {Function} [callback] - function(err, granted){} where:
   *    {Error} err - subscription error (none at the moment!)
   *    {Array} granted - array of {topic: 't', qos: 0}
   * @returns {MqttClient} this - for chaining
   * @api public
   * @example client.subscribe('topic')
   * @example client.subscribe('topic', {qos: 1})
   * @example client.subscribe({'topic': 0, 'topic2': 1}, console.log)
   * @example client.subscribe('topic', console.log)
   */
  public subscribe (topic:
                     string
                     | string[], opts: IClientSubscribeOptions, callback?: ClientSubscribeCallback): this
  public subscribe (topic:
                     string
                     | string[]
                     | ISubscriptionMap, callback?: ClientSubscribeCallback): this

  /**
   * unsubscribe - unsubscribe from topic(s)
   *
   * @param {String, Array} topic - topics to unsubscribe from
   * @param {Object} opts - opts of unsubscribe
   * @param {Function} [callback] - callback fired on unsuback
   * @returns {MqttClient} this - for chaining
   * @api public
   * @example client.unsubscribe('topic')
   * @example client.unsubscribe('topic', console.log)
   * @example client.unsubscribe('topic', opts, console.log)
   */
  public unsubscribe (topic: string | string[], opts?: Object, callback?: PacketCallback): this

  /**
   * end - close connection
   *
   * @returns {MqttClient} this - for chaining
   * @param {Boolean} force - do not wait for all in-flight messages to be acked
   * @param {Object} opts - opts disconnect
   * @param {Function} cb - called when the client has been closed
   *
   * @api public
   */
  public end (force?: boolean, opts?: Object, cb?: CloseCallback): this

  /**
   * removeOutgoingMessage - remove a message in outgoing store
   * the outgoing callback will be called withe Error('Message removed') if the message is removed
   *
   * @param {Number} mid - messageId to remove message
   * @returns {MqttClient} this - for chaining
   * @api public
   *
   * @example client.removeOutgoingMessage(client.getLastMessageId());
   */
  public removeOutgoingMessage (mid: number): this

  /**
   * reconnect - connect again using the same options as connect()
   *
   * @param {Object} [opts] - optional reconnect options, includes:
   *    {Store} incomingStore - a store for the incoming packets
   *    {Store} outgoingStore - a store for the outgoing packets
   *    if opts is not given, current stores are used
   *
   * @returns {MqttClient} this - for chaining
   *
   * @api public
   */
  public reconnect (opts?: IClientReconnectOptions): this

  /**
   * Handle messages with backpressure support, one at a time.
   * Override at will.
   *
   * @param packet packet the packet
   * @param callback callback call when finished
   * @api public
   */
  public handleMessage (packet: Packet, callback: PacketCallback): void

  /**
   * getLastMessageId
   */
  public getLastMessageId (): number
}
export { IClientOptions }
