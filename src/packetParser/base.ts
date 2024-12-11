export class PacketParser {


  public static async parse(blob: any): Promise<{ type: number|string; data: ArrayBuffer }> {
    const arrayBuffer = await blob.arrayBuffer();
    return { type: 1, data: arrayBuffer };
  }

  public static create(data: any): ArrayBuffer|string|Uint8Array[] {
    return data;
  }
}