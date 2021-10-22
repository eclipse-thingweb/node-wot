import * as MbusMaster from "node-mbus";
import { MBusForm } from "./mbus";
import { Content } from "@node-wot/core";
import { Readable } from "stream";

const configDefaults = {
    operationTimeout: 10000,
    connectionRetryTime: 10000,
    maxRetries: 5,
};

/**
 * MBusConnection represents a client connected to a specific host and port
 */
export class MBusConnection {
    host: string;
    port: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: any; // MBusClient.IMBusRTU
    connecting: boolean;
    connected: boolean;
    timer: NodeJS.Timer; // connection idle timer
    // eslint-disable-next-line no-use-before-define
    currentTransaction: MBusTransaction; // transaction currently in progress or null
    // eslint-disable-next-line no-use-before-define
    queue: Array<MBusTransaction>; // queue of further transactions
    config: {
        connectionTimeout?: number;
        operationTimeout?: number;
        connectionRetryTime?: number;
        maxRetries?: number;
    };

    constructor(
        host: string,
        port: number,
        config: {
            connectionTimeout?: number;
            operationTimeout?: number;
            connectionRetryTime?: number;
            maxRetries?: number;
        } = configDefaults
    ) {
        this.host = host;
        this.port = port;
        this.client = new MbusMaster({
            // new MBusClient();
            host: this.host,
            port: this.port,
            timeout: config.connectionTimeout,
            autoConnect: false,
        });
        this.connecting = false;
        this.connected = false;
        this.timer = null;
        this.currentTransaction = null;
        this.queue = new Array<MBusTransaction>();

        this.config = Object.assign(configDefaults, config);
    }

    /**
     * Enqueue a PropertyOperation by either creating a new MBusTransaction
     * or joining it with an existing compatible transaction.
     *
     * Note: The algorithm for joining operations implemented here is very simple
     * and can be further elaborated.
     *
     * Note: Devices may also have a limit on the size of a M-BUS transaction.
     * This is not accounted for in this implementation.
     *
     * @param op PropertyOperation to be enqueued
     */
    enqueue(op: PropertyOperation): void {
        // try to merge with any pending transaction
        for (const t of this.queue) {
            if (op.unitId === t.unitId) {
                t.inform(op);
                return;
            }
        }

        // create and append a new transaction
        const transaction = new MBusTransaction(this, op.unitId, op.base);
        transaction.inform(op);
        this.queue.push(transaction);
    }

    async connect(): Promise<void> {
        if (!this.connecting && !this.connected) {
            console.debug("[binding-mbus]", "Trying to connect to", this.host);
            this.connecting = true;

            for (let retry = 0; retry < this.config.maxRetries; retry++) {
                if (
                    this.client.connect((error: string) => {
                        if (error != null)
                            console.warn(
                                "[binding-mbus]",
                                "Cannot connect to",
                                this.host,
                                "reason",
                                error,
                                ` retry in ${this.config.connectionRetryTime}ms`
                            );
                    })
                ) {
                    this.connecting = false;
                    this.connected = true;
                    console.debug("[binding-mbus]", "MBus connected to " + this.host);
                    return;
                } else {
                    this.connecting = false;
                    if (retry >= this.config.maxRetries - 1) {
                        throw new Error("Max connection retries");
                    }
                    await new Promise((resolve, reject) => setTimeout(resolve, this.config.connectionRetryTime));
                }
            }
        }
    }

    /**
     * Trigger work on this connection.
     *
     * If the MBusConnection is unconnected, connect it and retrigger.
     * If no transaction is currently being processed but transactions are waiting,
     * start the next transaction.
     * Retrigger after success or failure.
     */
    async trigger(): Promise<void> {
        console.debug("[binding-mbus]", "MBusConnection:trigger");
        if (!this.connecting && !this.connected) {
            // connection may be closed due to operation timeout
            // try to reconnect again
            try {
                await this.connect();
                this.trigger();
            } catch (error) {
                console.warn("[binding-mbus]", "cannot reconnect to m-bus server");
                // inform all the operations that the connection cannot be recovered
                this.queue.forEach((transaction) => {
                    transaction.operations.forEach((op) => {
                        op.failed(error);
                    });
                });
            }
        } else if (this.connected && this.currentTransaction == null && this.queue.length > 0) {
            // take next transaction from queue and execute
            this.currentTransaction = this.queue.shift();
            try {
                await this.currentTransaction.execute();
                this.currentTransaction = null;
                this.trigger();
            } catch (error) {
                console.warn("[binding-mbus]", "transaction failed:", error);
                this.currentTransaction = null;
                this.trigger();
            }
        }
    }

    public close(): void {
        this.mbusstop();
    }

    async readMBus(transaction: MBusTransaction): Promise<unknown> {
        return new Promise<unknown>((resolve, reject) => {
            console.debug("[binding-mbus]", "Invoking read transaction");
            // reset connection idle timer
            if (this.timer) {
                clearTimeout(this.timer);
            }

            this.timer = global.setTimeout(() => this.mbusstop(), this.config.operationTimeout);

            this.client.getData(transaction.unitId, (error: string, data: unknown) => {
                if (error !== null) reject(error);
                resolve(data);
            });
        });
    }

    private mbusstop() {
        console.debug("[binding-mbus]", "Closing unused connection");
        this.client.close((err: string) => {
            if (err === null) {
                console.debug("[binding-mbus]", "session closed");
                this.connecting = false;
                this.connected = false;
            } else {
                console.error("[binding-mbus]", "cannot close session " + err);
            }
        });
        clearInterval(this.timer);
        this.timer = null;
    }
}

/**
 * MBusTransaction represents a raw M-Bus operation performed on a MBusConnection
 */
class MBusTransaction {
    connection: MBusConnection;
    unitId: number;
    base: number;
    // eslint-disable-next-line no-use-before-define
    operations: Array<PropertyOperation>; // operations to be completed when this transaction completes
    constructor(connection: MBusConnection, unitId: number, base: number) {
        this.connection = connection;
        this.unitId = unitId;
        this.base = base;
        this.operations = new Array<PropertyOperation>();
    }

    /**
     * Link PropertyOperation with this transaction, so that operations can be
     * notified about the result of a transaction.
     *
     * @param op the PropertyOperation to link with this transaction
     */
    inform(op: PropertyOperation) {
        op.transaction = this;
        this.operations.push(op);
    }

    /**
     * Trigger work on the associated connection.
     *
     * @see MBusConnection.trigger()
     */
    trigger() {
        console.debug("[binding-mbus]", "MBusTransaction:trigger");
        this.connection.trigger();
    }

    /**
     * Execute this MBusTransaction and resolve/reject the invoking Promise as well
     * as the Promises of all associated PropertyOperations.
     *
     * @param resolve
     * @param reject
     */
    async execute(): Promise<void> {
        // Read transaction
        console.debug("[binding-mbus]", "Trigger read operation on unit", this.unitId);
        try {
            const result = await this.connection.readMBus(this);
            console.debug("[binding-mbus]", "Got result from read operation on unit", this.unitId);
            this.operations.forEach((op) => op.done(op.base, result));
        } catch (error) {
            console.warn("[binding-mbus]", "read operation failed on unit", this.unitId, error);
            // inform all operations and the invoker
            this.operations.forEach((op) => op.failed(error));
            throw error;
        }
    }
}

/**
 * PropertyOperation represents a read or write operation on a property
 */
export class PropertyOperation {
    unitId: number;
    base: number;
    transaction: MBusTransaction; // transaction used to execute this operation
    resolve: (value?: Content | PromiseLike<Content>) => void;
    reject: (reason?: Error) => void;

    constructor(form: MBusForm) {
        this.unitId = form["mbus:unitID"];
        this.base = form["mbus:offset"];
        this.transaction = null;
    }

    /**
     * Trigger execution of this operation.
     *
     */
    async execute(): Promise<Content | PromiseLike<Content>> {
        return new Promise(
            (resolve: (value?: Content | PromiseLike<Content>) => void, reject: (reason?: Error) => void) => {
                this.resolve = resolve;
                this.reject = reject;

                if (this.transaction == null) {
                    reject(new Error("No transaction for this operation"));
                } else {
                    this.transaction.trigger();
                }
            }
        );
    }

    /**
     * Invoked by the MBusTransaction when it has completed successfully
     *
     * @param base Base register offset of the transaction (on read)
     * @param result Result data of the transaction (on read)
     * @param data Result data of the transaction as array (on read)
     */
    done(
        base?: number,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
        result?: any
    ): void {
        console.debug("[binding-mbus]", "Operation done");

        // extract the proper part from the result and resolve promise
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let payload: any = "";
        if (base === -1) {
            payload = result.SlaveInformation;
        } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            result.DataRecord.forEach((dataRec: any) => {
                if (base === dataRec.id) {
                    payload = dataRec;
                }
            });
        }

        const resp: Content = {
            body: Readable.from(JSON.stringify(payload)),
            type: "application/json",
        };

        // resolve the Promise given to the invoking script
        this.resolve(resp);
    }

    /**
     * Invoked by the MBusTransaction when it has failed.
     *
     * @param reason Reason of failure
     */
    failed(reason: string): void {
        console.warn("[binding-mbus]", "Operation failed:", reason);
        // reject the Promise given to the invoking script
        this.reject(new Error(reason));
    }
}
