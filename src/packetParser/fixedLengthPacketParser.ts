import { createCommonHeader, createStruct } from '@/components/WebRTCSignalClient/common';
import { EXEC_RESULT } from '@/lib/websocket/EXEC_RESULT';
import { ZX_COMM_HEAD } from '@/lib/websocket/zx_comm_head';
import { Buffer } from 'buffer';
import { PacketParser } from './base';

/**
 * 结构数据接口定义
 */
interface StructureData {
  ivalue?: number;      // 整型值
  ivalue1?: number;     // 整型值1
  channel?: number;     // 通道号
  value?: string | number; // 通用值
  account?: string;     // 账户
  value1?: string;      // 值1
  sn?: string;      // sn
  hub_name?: string;      // hub_name
  time_tone?: string;      // time_tone
}

/**
 * 消息响应接口定义
 */
interface MessageResponse {
  data: any;           // 响应数据
  cmd: number;         // 命令号
  command_id: number;  // 命令ID
  segmen: number;      // 分段号
  err_code: number;    // 错误码
  is_response: number; // 是否为响应消息
}

/**
 * 数据包接口定义
 */
interface PacketData {
  command_id: number;  // 命令ID
  payload: any;        // 负载数据
  cmd?: number;        // 命令号
  account_id?: string; // 账户ID
  channel_id?: number; // 通道ID
}

/**
 * 结构配置定义
 * 包含不同类型消息的命令ID和对应的负载创建函数
 */
const STRUCTURE_CONFIGS = {
  // 双整数参数设置
  PARAM_TWO_INT_SET: {
    commandIds: [1103, 1252, 1214, 1207, 1230, 1056, 1200, 1240],
    createPayload: (data: StructureData): Uint8Array =>
      createStruct(136, [
        `4:${data.value || 0}`,
        `4:${data.value1 || 0}`,
        `128:${data.account || ''}`,
      ], ['hex', 'hex', 'string']),
  },
  // 参数设置
  PARAM_SET_PARAM: {
    commandIds: [1217, 1216, 1215],
    createPayload: (data: StructureData): Uint8Array =>
      createStruct(261, [
        `2:${data.ivalue || 0}`,
        `2:${data.ivalue1 || 0}`,
        `1:${data.channel || 0}`,
        `128:${data.value || ''}`,
        `128:${data.account || ''}`,
      ], ['hex', 'hex', 'hex', 'string', 'string']),
  },
  // 单整数参数设置
  PARAM_ONE_INT_SET: {
    commandIds: [1253, 1040, 1034, 1036],
    createPayload: (data: StructureData): Uint8Array =>
      createStruct(132, [
        `4:${data.value || 0}`,
        `128:${data.account || ''}`,
      ], ['hex', 'string']),
  },
  // 参数设置
  PARAM_APP_BIND_ACCOUNT: {
    commandIds: [1002],
    createPayload: (data: StructureData): Uint8Array =>
      createStruct(209, [
        `17:${data.sn || ''}`,
        `128:${data.account || ''}`,
        `32:${data.hub_name || ''}`,
        `32:${data.time_tone || ''}`,
      ], ['string', 'string', 'string', 'string']),
  },
} as any;

/**
 * 消息解析器类
 * 处理消息的解析和创建
 */
class MessageParser {
  /**
   * 根据命令ID获取对应的结构类型
   * @param command_id 命令ID
   * @returns 结构类型名称或undefined
   */
  private static getStructureType(command_id: number): string | undefined {
    return Object.entries(STRUCTURE_CONFIGS).find(
      ([_, config]: any[]) => config.commandIds.includes(command_id)
    )?.[0];
  }

  /**
   * 创建负载缓冲区
   * @param command_id 命令ID
   * @param payload 负载数据
   * @param cmd 命令号
   * @param account_id 账户ID
   * @returns Uint8Array 缓冲区
   */
  public static createPayloadBuffer(
    command_id: number,
    payload: any,
    cmd?: number,
    account_id?: string
  ): Uint8Array {
    const structureType = this.getStructureType(command_id);

    if (structureType) {
      return STRUCTURE_CONFIGS[structureType].createPayload(payload);
    }

    // 特殊命令ID处理
    if (command_id === 1700) {
      return Buffer.from(JSON.stringify({ cmd, account_id, ...payload }));
    }

    return Buffer.from(JSON.stringify({ cmd, account_id, payload }));
  }

  /**
   * 解析消息
   * @param blob 二进制数据
   * @returns Promise<MessageResponse>
   */
  public static async parseMessage(blob: Blob): Promise<MessageResponse> {
    const data = await blob.arrayBuffer();
    const buffer = Buffer.from(data);
    const header = this.parseHeader(buffer);

    const response: MessageResponse = {
      data: {},
      cmd: 0,
      command_id: header.command_id,
      segmen: header.segmen,
      err_code: -1,
      is_response: header.is_response,
    };

    return header.is_response
      ? this.handleResponse(buffer, response)
      : this.handleNotification(buffer, response);
  }

  /**
   * 解析消息头
   * @param buffer 缓冲区
   * @returns ZX_COMM_HEAD
   */
  private static parseHeader(buffer: Buffer): ZX_COMM_HEAD {
    const headerBuffer = buffer.slice(0, 16);
    return ZX_COMM_HEAD.fromArrayBuffer(headerBuffer.buffer);
  }

  /**
   * 处理响应消息
   * @param buffer 缓冲区
   * @param response 响应对象
   * @returns Promise<MessageResponse>
   */
  private static async handleResponse(
    buffer: Buffer,
    response: MessageResponse
  ): Promise<MessageResponse> {
    const execResult = EXEC_RESULT.fromArrayBuffer(buffer.buffer.slice(16, 148));
    response.err_code = execResult.error_code;
    response.data = new TextDecoder().decode(execResult.error_info).trim();
    return response;
  }

  /**
   * 处理通知消息
   * @param buffer 缓冲区
   * @param response 响应对象
   * @returns Promise<MessageResponse>
   */
  private static async handleNotification(
    buffer: Buffer,
    response: MessageResponse
  ): Promise<MessageResponse> {
    response.err_code = 0;
    const content = new TextDecoder().decode(buffer.buffer.slice(16)).trim();

    try {
      response.data = content;
      console.log('Notification data:', content);
      if (content.includes('heartbeat')) {
        console.log('heartbeat');
        return {} as any;
      }

      response.cmd = JSON.parse(content.split('\x00').join('')).cmd || 0;
    } catch (error) {
      console.error('Failed to parse notification data:', error);
      response.cmd = 0;
    }

    return response;
  }
}

/**
 * 固定长度数据包解析器
 * 继承自PacketParser基类
 */
export class FixedLengthPacketParser extends PacketParser {
  public static typeDic = {};

  /**
   * 解析数据包
   * @param blob 二进制数据
   * @returns Promise<{type: string, data: any}>
   */
  public static async parse(blob: Blob): Promise<{ type: string; data: any }> {
    const messageData = await MessageParser.parseMessage(blob);
    // 构造消息类型
    const type = messageData.is_response
      ? `response_${messageData.command_id}`
      : `${messageData.command_id}_${messageData.cmd}`;

    return { type, data: messageData };
  }

  /**
   * 创建数据包
   * @param type 类型
   * @param data 数据
   * @returns ArrayBuffer
   */
  public static create(data: PacketData): ArrayBuffer {

    const { command_id, payload, cmd, account_id, channel_id } = data;

    // 创建负载buffer
    const payloadBuffer = MessageParser.createPayloadBuffer(
      command_id,
      payload,
      cmd,
      account_id
    );

    // 创建头部buffer
    const headerBuffer = createCommonHeader(
      command_id,
      payloadBuffer.byteLength,
      channel_id ?? 255,
      0, 0
    );

    // 合并头部和负载
    return Buffer.concat([Buffer.from(headerBuffer), payloadBuffer]);
  }
}