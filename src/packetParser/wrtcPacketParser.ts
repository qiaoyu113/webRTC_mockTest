import CommandProcessor from '@/components/WebRTCSignalClient/CommandProcessor';
import { COMMAND_ID_HEARTBEAT, createChannelHeader, createCommonHeader, createStruct, hexAck, hexArrayToJson, jsonToHexArray, parseChannelHeader, parseCommonHeader, WrtcLinkTypeCmd, WrtcLinkTypeInne, WrtcLinkTypeLive, WrtcLinkTypeNotify, WrtcLinkTypePlayback } from '@/components/WebRTCSignalClient/common';
import { avCommandIDs, packetLength, returnJson } from '@/components/WebRTCSignalClient/const';
import { PacketParser } from './base';
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
 * 固定长度数据包解析器
 * 继承自PacketParser基类
 */
export class WebRtcPacketParser extends PacketParser {
  public static typeDic = {};
  private static map: any = {};

  /**
   * 解析数据包
   * @param blob 二进制数据
   * @returns Promise<{type: string, data: any}>
   */
  public static parse(blob: Blob): Promise<{ type: string; data: any }> {
    // console.log('blob', await blob);
    return new Promise((resolve) => {
      blob.arrayBuffer().then(async (buffer) => {
        const data = WebRtcPacketParser.parseData(buffer);
        return data;
      }).then(data => {
        if (data) {

          const { linkType, commandID, isResponse } = data as any;
          // console.info('>>>>>isResponse', isResponse);

          this.map[(data as any).linkType] = null;
          delete this.map[(data as any).linkType];
          if (linkType === WrtcLinkTypeNotify) {
            // console.log('>>>>>data', data, linkType, WrtcLinkTypeCmd, linkType === WrtcLinkTypeCmd);
          }


          if (linkType === WrtcLinkTypeCmd) {
            resolve({ type: 'response_' + commandID, data });
          } else if (linkType === WrtcLinkTypeNotify) {
            const { cmd } = (data as any).data;
            resolve({ type: `${commandID}_${cmd ?? 0}`, data });
          }
          else if (linkType === WrtcLinkTypeLive) {
            // console.log('>>>>>live', data);

            resolve({ type: 'live', data });
          }
          else if (linkType === WrtcLinkTypePlayback) {
            // console.log('>>>>>live', data);

            resolve({ type: 'playback', data });
          }
          else {
            resolve({ type: 'ping', data: {} });
          }
        }
      }).catch((error) => {
        console.error('Failed to parse notification data:', error);
        resolve({ type: 'ping', data: {} });
      });



    });


    // console.log(data);

  }
  private static handleNewPackage(buffer: Uint8Array, linkType: number) {
    if (buffer.byteLength < 16) return null;
    const { commandID, paramLen, isResponse } = parseCommonHeader(buffer.slice(0, 16));
    // console.info('>>>>>>isResponse1', isResponse);

    const payload = buffer.slice(16);
    const len = payload.byteLength;
    // console.log('>>>>>>commandID', commandID, paramLen, len);
    // console.log('>>>>>comPackage', WebRtcPacketParser.map[linkType]);
    if (paramLen === len) {
      return WebRtcPacketParser.createParsedData(commandID, buffer, linkType, isResponse);
    }

    if (len < paramLen) {

      WebRtcPacketParser.map[linkType] = { commandID, isResponse, paramLen, buffer, mergeLen: len };
      return null;
    }
  }

  private static handleExistingPackage(buffer: Uint8Array, linkType: number) {
    const payload = buffer;
    const len = payload.byteLength;


    if (len + WebRtcPacketParser.map[linkType].mergeLen >= WebRtcPacketParser.map[linkType].paramLen) {
      const mergePayload = new Uint8Array(WebRtcPacketParser.map[linkType].paramLen + 16);
      mergePayload.set(WebRtcPacketParser.map[linkType].buffer, 0);
      mergePayload.set(payload, WebRtcPacketParser.map[linkType].buffer.byteLength);
      return WebRtcPacketParser.createParsedData(
        WebRtcPacketParser.map[linkType].commandID,
        mergePayload,
        linkType,
        this.map[linkType].isResponse,
      );
    }

    if (len + WebRtcPacketParser.map[linkType].mergeLen < WebRtcPacketParser.map[linkType].paramLen) {
      const mergeBuffer = new Uint8Array(
        WebRtcPacketParser.map[linkType].buffer.byteLength + len,
      );
      mergeBuffer.set(WebRtcPacketParser.map[linkType].buffer, 0);
      mergeBuffer.set(payload, WebRtcPacketParser.map[linkType].buffer.byteLength);
      WebRtcPacketParser.map[linkType].buffer = mergeBuffer;
      WebRtcPacketParser.map[linkType].mergeLen += len;
      return null;
    }
  }
  private static parseData(arrayBuffer: ArrayBuffer) {
    const buffer = new Uint8Array(arrayBuffer);
    // console.log('buffer', buffer.byteLength);

    if (buffer.byteLength < 40) return;
    // const { seqNum, dataLen } = parseFileHeader(buffer.slice(0, 20));
    const { linkType, bodyLength } = parseChannelHeader(buffer.slice(20, 40));
    // const { commandID, paramLen } = WebRtcPacketParser.parseHeader(buffer.slice(36, 52))
    // const payload = buffer.slice(52, 52 + paramLen)
    // if (buffer.byteLength < 16) return
    if (linkType !== WrtcLinkTypeInne) {
      // console.log('>>>>>linkType', linkType, bodyLength);
    } else {
      // console.log('>>>>>心跳', linkType);
    }
    if (linkType !== WrtcLinkTypeInne) {
      const newBuffer = buffer.slice(40, 40 + bodyLength);
      // if (!WebRtcPacketParser.comPackage) {
      if (!WebRtcPacketParser.map[linkType]) {
        const data = WebRtcPacketParser.handleNewPackage(newBuffer, linkType);
        // console.log('>>>>>data', data);

        const result = data ? { ...data, linkType } : null;
        // console.log('>>>>>result', result);

        return result;
      } else {

        const data = WebRtcPacketParser.handleExistingPackage(newBuffer, linkType);
        // console.log('>>>>>data2', data);

        const result = data ? { ...data, linkType } : null;
        // console.log('>>>>>result2', result);
        return result;
      }
    } else {
      return { data: WrtcLinkTypeInne };
    }
  }
  private static getStructureType(command_id: number): string | undefined {
    return Object.entries(STRUCTURE_CONFIGS).find(
      ([_, config]: any[]) => config.commandIds.includes(command_id)
    )?.[0];
  }
  /**
   * 创建数据包
   * @param type 类型
   * @param data 数据
   * @returns ArrayBuffer
   */
  public static create(sendData: any): ArrayBuffer | Uint8Array[] {
    if(sendData === 'ping'){
      // console.log('发送ping包',sendData );
      
      const header = createCommonHeader(COMMAND_ID_HEARTBEAT, 0, 0, 0, 0);
      const channelHeader = createChannelHeader(
        header.byteLength,
        WrtcLinkTypeInne,
      );
      const wrtcBuffer = new Uint8Array(
        channelHeader.byteLength + header.byteLength,
      );
      wrtcBuffer.set(new Uint8Array(channelHeader), 0);
      wrtcBuffer.set(new Uint8Array(header), channelHeader.byteLength);
      return [wrtcBuffer];
    }
    const wrtcDataList = [];
    const result = CommandProcessor.processCommand(sendData);
    // let newSegment: number
    // 生成一个不重复的随机数
    // do {
    //   newSegment = this.generateRandomNumber()
    // } while (this.isNumberInReceiveQueue(newSegment))
    // const sendData = { ...result, segmen: newSegment }
    const data = { ...result };
    const structureType = this.getStructureType(data.commandID);
    // console.log('>>>>>structureType', structureType, data.payload.payload);

    let payload: any = data.payload;
    if (structureType) {
      const data = { ...(payload.payload ?? {}), account: payload.account_id };
      payload = STRUCTURE_CONFIGS[structureType].createPayload(data);
      // console.log('>>>>>structureType', payload);
    } else {
      payload = jsonToHexArray(data.payload);
    }
    const header = createCommonHeader(
      data.commandID,
      payload.byteLength,
      data.channelID,
      data.segmen || 0,
      data.isResponse || 0,
    );
    // let bufferTemp;
    // const seq: number = 0;
    // console.info('>>>>>header', data.isResponse);

    let bufferTemp = new Uint8Array(header.byteLength + payload.byteLength);
    bufferTemp.set(new Uint8Array(header), 0);
    bufferTemp.set(new Uint8Array(payload), header.byteLength);
    while (bufferTemp.byteLength > packetLength) {
      const temp = bufferTemp.slice(0, packetLength);
      const channelHeader = createChannelHeader(
        temp.byteLength,
        WrtcLinkTypeCmd,
      );
      const tempWrtc = new Uint8Array(packetLength + 20);
      tempWrtc.set(new Uint8Array(channelHeader), 0);
      tempWrtc.set(temp, 20);
      // const fileHeader = this.createFileHeader(tempWrtc, seq)
      // const tempWrtcBuffer = new Uint8Array(packetLength + 40)
      // tempWrtcBuffer.set(new Uint8Array(fileHeader), 0)
      // tempWrtcBuffer.set(tempWrtc, 20)
      // return tempWrtc;
      wrtcDataList.push(tempWrtc);
      bufferTemp = bufferTemp.slice(packetLength);
      // seq++;
    }
    const channelHeader = createChannelHeader(
      bufferTemp.byteLength,
      WrtcLinkTypeCmd,
    );
    const tempWrtc = new Uint8Array(bufferTemp.byteLength + 20);
    tempWrtc.set(new Uint8Array(channelHeader), 0);
    tempWrtc.set(bufferTemp, 20);

    // console.log('>>>>>tempWrtc', tempWrtc);
    wrtcDataList.push(tempWrtc);
    return wrtcDataList;
  }
  private static createParsedData(
    commandID: number,
    payload: Uint8Array,
    linkType: number,
    isResponse: number = 0
  ) {


    let data;

    if (avCommandIDs.includes(commandID)) {
      data = payload; // 如果 commandID 在 avCommandIDs 中
    } else if (linkType === WrtcLinkTypeCmd) {
      data = hexAck(payload.slice(16)); // 如果 linkType 是 WrtcLinkTypeCmd
    } else if (returnJson.includes(commandID)) {
      data = hexArrayToJson(payload.slice(16)); // 如果 commandID 在 returnJson 中
    } else if (linkType === WrtcLinkTypeNotify) {
      let jsonObj = hexArrayToJson(payload.slice(16));
      const { cmd } = jsonObj;
      if (typeof jsonObj === 'object') {
        jsonObj = JSON.stringify(jsonObj);
      }
      data = {
        data: jsonObj,
        cmd
      };
    }
    else {
      data = hexAck(payload.slice(16)); // 其他情况
    }

    // console.log('>>>>>createParsedData', data, avCommandIDs.includes(commandID));

    return { commandID, data, isResponse };
  }
}