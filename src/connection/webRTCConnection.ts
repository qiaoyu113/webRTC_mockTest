import { Connection } from './connection';
import type { ConnectionConfig } from './connection';
export type WebRTCConnectionConfig = ConnectionConfig & {
  onOffer?: (offer: RTCSessionDescriptionInit) => void;
  onCandidate?: (offer: RTCIceCandidate) => void;
  onAnswer?: (wrtc: WebRTCConnection) => void
  configuration?: RTCConfiguration;
  channel: {
    cmdChannelName: string;
    cmdChannelOptions: RTCDataChannelInit;
  };
}
export class WebRTCConnection extends Connection {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private configuration: RTCConfiguration;
  onOffer?: (offer: RTCSessionDescriptionInit) => void;
  onCandidate?: (offer: RTCIceCandidate) => void;
  onAnswer?: (wrtc: WebRTCConnection) => void;
  channel: {
    cmdChannelName: string;
    cmdChannelOptions: RTCDataChannelInit;
  };
  public constructor({ url, packetParser,heartbeatInterval, onOffer, configuration, onCandidate, onAnswer, channel }: WebRTCConnectionConfig) {
    super({ url, packetParser,heartbeatInterval });
    this.onOffer = onOffer;
    this.onCandidate = onCandidate;
    this.onAnswer = onAnswer;
    this.channel = channel;
    this.configuration = configuration || {
      iceServers: []
    };
    this.peerConnection = new RTCPeerConnection(this.configuration);
  }

  public async connect(): Promise<void> {
    if (this.dataChannel) {
      console.log('WebRTC数据通道已经连接');
      return;
    }
    console.log('WebRTC数据通道未连接，开始建立连接');

    return new Promise((resolve, reject) => {


      this.dataChannel = this.peerConnection!.createDataChannel(this.channel?.cmdChannelName, this.channel?.cmdChannelOptions);

      this.dataChannel.onopen = () => {
        console.log('WebRTC数据通道已建立');
        this.startHeartbeat();
        resolve();
      };

      this.dataChannel.onerror = (error) => {
        console.error('WebRTC数据通道错误:', error);
        this.scheduleReconnect();
        reject(error);
      };

      this.dataChannel.onmessage = (event) => {
        // 处理接收到的数据
        // ArrayBuffer转Blob
        // console.log('接收报文:', event.data);
        const blob = new Blob([event.data]);
        // console.log('接收报文:', blob);
        this.handleMessage(blob);
      };

      this.dataChannel.onclose = () => {
        console.log('WebRTC数据通道已关闭');
        this.dataChannel = null;
        this.stopHeartbeat();
        this.scheduleReconnect();
      };

      // 创建offer并设置本地描述
      this.peerConnection!.onicecandidate = (event) => {
        console.log('onicecandidate', event);
        if (event.candidate) {
          this.onCandidate?.(event.candidate);
        }
      };
      console.log(this.peerConnection!.signalingState);

      this.peerConnection!.createAnswer()
        .then((offer) => {
          this.peerConnection!.setLocalDescription(offer);
          console.log('创建offer成功:', offer);
          this.onOffer?.(offer);
        })

        .catch((error) => {
          console.error('创建offer失败:', error);
          reject(error);
        });
    });
  }
  public async handleAnswer(data: any) {
    console.log('handleAnswer', data);

    await this.peerConnection?.setRemoteDescription(
      new RTCSessionDescription(data)
    );
    await this.connect();
    if (this.onAnswer)
      this.onAnswer(this);
  }
  public async handleCandidate(data: any) {
    console.log('handleCandidate', data);

    await this.peerConnection?.addIceCandidate(
      new RTCIceCandidate(data.candidate)
    );
  }
  public disconnect(): void {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.stopHeartbeat();
    this.cancelReconnect();
  }

  public async sendData(data: ArrayBuffer[]) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.error('WebRTC数据通道未连接，无法发送报文');
      return;
    }

    const base64 = btoa(String.fromCharCode.apply(null, [...new Uint8Array(data[0])]));
    console.log('发送报文:', base64, data);
    for(const item of data) {
      this.dataChannel.send(item);
    }
    // this.dataChannel.send(data);
  }
}
