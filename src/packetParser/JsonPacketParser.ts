import { PacketParser } from './base';

export class JsonPacketParser extends PacketParser {


  public static async parse(blob: Blob): Promise<{ type: number; data: any }> {
    if (!(blob instanceof Blob)) {
      throw new Error('输入必须是 Blob');
    }
    // blob转字符串
        
    const buffer = await blob.arrayBuffer();
    const decoder = new TextDecoder();
    const str = decoder.decode(buffer);

    console.log('JsonPacketParser:', str);
        
    let obj = null;
    try {
      obj = JSON.parse(str);
    } catch (_error) {
      obj = null;
    }
    return {
      type: obj?.type || 0,
      data: obj?.data || null
    };
  }

  public static create(data: any): ArrayBuffer {
    const str = JSON.stringify({  data });
    const encoder = new TextEncoder();
    const buffer = encoder.encode(str);
    return buffer;
  }
}