import {randomString} from "./utils";
import DebugLogger from "./logger";

enum DataPackType {
    request = '__window_linker_request__',
    response = '__window_linker_response__',
}

interface DataPack {
    __type__: DataPackType.request | DataPackType.response;
    sessionId: string;
}

interface RequestDataPack<TOriginData> extends DataPack {
    isIgnoreReturn: boolean;
    actionName: string;
    originData?: TOriginData;
}

interface ResponseDataPack<TOriginData> extends DataPack {
    isSuccess: boolean;
    errorMessage?: string;
    originData?: TOriginData;
}

/**
 * 实例配置
 */
interface WindowLinkerConfig {
    /**
     * 是否启用Debug日志打印，控制台打印会有更多的详细信息
     */
    enableDebugLog: boolean;
}

interface WindowLinkerSendConfig {
    /**
     * 超时时间
     */
    timeout?: number;
    /**
     * 是否忽略返回
     */
    isIgnoreReturn?: boolean;
    /**
     * 用于postMessage进行同源判断
     */
    targetOrigin?: string;
}

/**
 * Promise 构造函数executor类型，直接参考Promise的executor类型定义
 */
type PromiseExecutor<T = any> = {
    timerId: number;
    isTimeout: boolean;
    resolve: (value: T | PromiseLike<T>) => void,
    reject: (reason?: any) => void
};

class WindowLinker {

    /**
     * sessionId与Promise executor的映射表
     * @private
     */
    private readonly _executorRecords: {
        [sessionId: string]: PromiseExecutor
    };

    /**
     * 存放作为action响应侧的action对应handler
     * @private
     */
    private readonly _actionHandler: {
        [actionName: string]: (args: any) => any | Promise<any>
    }

    /**
     * 初始化标识
     * @private
     */
    private _initialed: boolean;

    /**
     * Debug日志打印
     * @private
     */
    private _debugLogger: DebugLogger;

    constructor(config?: WindowLinkerConfig) {
        const {
            enableDebugLog = false
        } = config || {};
        this._executorRecords = {};
        this._actionHandler = {};
        this._initialed = false;
        this._debugLogger = new DebugLogger(enableDebugLog);
    }

    /**
     * 初始化
     */
    init() {
        if (this._initialed) {
            return;
        }
        window.addEventListener('message', async event => {

            this._debugLogger.print('message event', event);

            // todo 添加对origin的控制，定义origin白名单

            const dataPack = event.data as DataPack;
            const {__type__} = dataPack;

            if (![DataPackType.request, DataPackType.response].includes(__type__)) {
                // 数据没有特殊的type标识，不处理
                console.warn('unknown window message');
                return;
            }

            if (DataPackType.request === __type__) {
                // 处理数据包类型是对方的请求数据包
                this._debugLogger.print('handle request, sessionId: ' + dataPack.sessionId);
                const requestDataPack = dataPack as RequestDataPack<any>;
                const responseDataPack = await this.handleRequestTypeDataPack(requestDataPack);

                if (responseDataPack === null) {
                    // 为null说明请求方不需要返回
                    return;
                }
                // 需要将source对象强制转为WindowProxy，否则TS类型检查不过
                (event.source as WindowProxy).postMessage(responseDataPack, event.origin);
            }

            if (DataPackType.response === __type__) {
                // 处理数据包类型是对方响应而来的数据
                this._debugLogger.print('handle response, sessionId: ' + dataPack.sessionId);
                const responseDataPack = dataPack as ResponseDataPack<any>;
                this.handleResponseTypeDataPack(responseDataPack);
            }
        });
        this._initialed = true;
    }

    /**
     * 处理对方的请求数据
     * 对于当前的接收侧，需要找出处理对方action请求的handler，
     * 执行完成后将数据回给对方。
     * @param sourceRequestDataPack 请求方发来的数据包
     * @private
     * @return Promise<ResponseDataPack<any> | null>
     *     ResponseDataPack<any>：处理完成（成功or异常），封装为一个响应包
     *     null：处理完成，但请求方不需要忽略返回。
     */
    private async handleRequestTypeDataPack
    (sourceRequestDataPack: RequestDataPack<any>): Promise<ResponseDataPack<any> | null> {
        const {
            sessionId,
            actionName,
            isIgnoreReturn,
            originData
        } = sourceRequestDataPack;

        const handler = this._actionHandler[actionName];
        if (!handler) {
            return {
                __type__: DataPackType.response,
                sessionId,
                isSuccess: false,
                errorMessage: `[window-linker-error]cannot find a handler for action '${actionName}'`
            };
        }

        // 匹配上handler后，调用handler进行处理，
        // 根据处理结果封装响应数据包返回给上层
        try {
            // 利用await将普通返回值和Promise返回值，归一化为Promise
            const handleResult = await handler(originData);
            if (isIgnoreReturn) {
                // 如果请求方不需要返回值，则返回null数据包
                return null
            }
            // 否则，组织响应数据包
            return {
                __type__: DataPackType.response,
                sessionId,
                isSuccess: true,
                originData: handleResult
            };
        } catch (err) {
            // 如果handler执行过程就出现错误
            if (isIgnoreReturn) {
                // 如果请求方不需要返回值，则直接置为null
                return null;
            } else {
                // 否则，需要数据包组成为异常数据数据包
                let errMsg;
                if (err) {
                    errMsg = (err as any).message || err.toString();
                } else {
                    errMsg = '[window-linker-error]unknown error';
                }
                return {
                    __type__: DataPackType.response,
                    sessionId,
                    isSuccess: false,
                    errorMessage: errMsg
                };
            }
        }
    }

    /**
     * 处理对方的请求数据
     * 对于当前的接收侧，通常是先request后，对方发送响应数据
     * 此时，通常需要从_executorRecords中找到Promise的executor来完成Promise，且清理timer
     * @param responseDataPack
     * @private
     */
    private handleResponseTypeDataPack(responseDataPack: ResponseDataPack<any>) {

        const {
            sessionId,
            isSuccess,
            errorMessage,
            originData
        } = responseDataPack;

        const executor = this._executorRecords[sessionId];
        if (!executor) {
            console.error('cannot find executor');
            return;
        }
        if (executor.isTimeout) {
            // 判断超时，不进行后续处理，并移除executor
            console.error('timeout');
            delete this._executorRecords[sessionId];
            return;
        }

        // 收到响应，则清除timer
        window.clearTimeout(executor.timerId);

        // 处理Promise
        if (isSuccess) {
            executor.resolve(originData);
        } else {
            executor.reject(new Error(errorMessage));
        }

        delete this._executorRecords[sessionId];
    }

    /**
     * 给目标窗体发送数据
     */
    send<TData = any, TReturnData = any>(
        targetWindow: Window,
        actionName: string,
        data: TData,
        requestConfig: WindowLinkerSendConfig): Promise<undefined | TReturnData> {

        // 默认配置
        const config: WindowLinkerSendConfig = {
            timeout: 30 * 1000, // 默认 30 秒
            isIgnoreReturn: false,
            targetOrigin: '*'
        };
        // 融合用户提供的配置
        Object.assign(config, requestConfig);

        // 产生一个随机ID
        const sessionId = randomString();

        const requestDataPack: RequestDataPack<TData> = {
            __type__: DataPackType.request,
            actionName,
            sessionId,
            originData: data,
            isIgnoreReturn: config.isIgnoreReturn!
        }

        this._debugLogger.print('send request, config and requestDataPack', config, requestDataPack);

        if (requestDataPack.isIgnoreReturn) {
            // 忽略返回的话，发送端直接resolve/reject，无需等待处理以及超时处理
            targetWindow.postMessage(requestDataPack, config.targetOrigin!);
            return Promise.resolve(undefined);
        }

        // 不忽略返回，则需要构造Promise，并开启一个定时器
        return new Promise<TReturnData>((resolve, reject) => {

            // 构造timer，
            const timerId = window.setTimeout(() => {
                // 超时的时候reject，
                reject(new Error('[window-linker-error]window communication timeout'));
                // 超时需要特殊标识该executor已经超时，不能在此删除
                // 而是在 handleResponseTypeDataPack 中判断标识才删除
                this._executorRecords[sessionId].isTimeout = true;

            }, config.timeout);

            // 先存储会话对应的executor/timer
            this._executorRecords[sessionId] = {
                timerId,
                isTimeout: false, // 此时还未超时
                resolve,
                reject
            };

            targetWindow.postMessage(requestDataPack, config.targetOrigin!);
        })
    }

    /**
     * 监听某个Action
     * @param actionName
     * @param cb
     */
    listen(actionName: string, cb: (data: any) => any | Promise<any>) {
        this._actionHandler[actionName] = cb;
    }
}

export {
    WindowLinker
}

export type {
    WindowLinkerConfig,
    WindowLinkerSendConfig
}
