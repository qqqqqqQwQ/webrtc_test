const SIGNAL_TYPE_JOIN="join"; //浏览器->服务器,加入房间;服务器->浏览器，加入结果
const SIGNAL_TYPE_RESP_JOIN="resp-join"; //服务器->浏览器，房间已有谁
const SIGNAL_TYPE_LEAVE="leave"; //浏览器->服务器，请求离开房间
const SIGNAL_TYPE_NEW_PEER="new-peer"; //服务器->浏览器，新加入的谁
const SIGNAL_TYPE_PEER_LEAVE="peer-leave"; //服务器->浏览器，谁离开了房间
const SIGNAL_TYPE_OFFER="offer"; //
const SIGNAL_TYPE_ANSWER="answer";
const SIGNAL_TYPE_CANDIDATE="candidate";

let localUserId=Math.random().toString(36).substring(2);
let remoteUserId=[]
let roomId=1
let pc;

const app=document.querySelector("#app")
const ROOMID=document.querySelector("#RoomId")
const localVideo=document.querySelector("#localVideo")
const remoteVideo=document.querySelector("#remoteVideo")
let localStream=null
const join=document.querySelector("#join")
const leave=document.querySelector("#leave")

function show(str,type){
    const text=document.createElement("div");
    text.innerHTML=str;
    if(type=="enter"){
        text.style.color="blue";
    } else if(type=="leave"){
        text.style.color="red"
    }
    document.body.append(text);
}
const constrains = {
    audio: true,
    video: {width: 640 ,
    height:  480 ,
    // frameRate: {
    // ideal: 10,
    // max: 15
    // },
    facingMode: "user"
    }
    };
// 将音视频流Stream放到localVideo，localStream
//成功的回调函数
async function success(stream) {
    //兼容webkit内核浏览器
    var CompatibleURL = window.URL || window.webkitURL;
    //将视频流设置为video元素的源
    try {
    // 已经废弃的方法
     localVideo.src =CompatibleURL.createObjectURL(stream);
    } catch (e) {
    // 新方法
    console.warn(e);
    localVideo.srcObject = stream;
    }
        
    
    doJoin(roomId)
    // 保存视频流
    localStream = stream;
    
    console.log('test001');
    
    //播放视频
    
}
//异常的回调函数
function error(error) {
    console.log("访问用户媒体设备失败：", error.name, error.message);
}
function closeCamera() {
    // 停止媒体轨道
    if (localVideo.srcObject) {
      const tracks = localVideo.srcObject.getTracks();
      tracks.forEach(function (track) {
        track.stop();
      });
    } else if (localVideo.src !== '') {
      // 兼容旧的方法，已废弃的 createObjectURL
      window.URL.revokeObjectURL(localVideo.src);
    }
  
    // 清除视频元素的srcObject或src属性
    localVideo.srcObject = null;
    localVideo.src = '';
}
  

// 浏览器获取摄像头和录音权限，成功后调用openLocalStream
function getUserMedia(constrains, success, error) {
    if (navigator.mediaDevices.getUserMedia) {
    //最新标准API
    navigator.mediaDevices
    .getUserMedia(constrains)
    .then(success)
    .catch(error);
    } else if (navigator.webkitGetUserMedia) {
    //webkit内核浏览器
    navigator
    .webkitGetUserMedia(constrains)
    .then(success)
    .catch(error);
    } else if (navigator.mozGetUserMedia) {
    //Firefox浏览器
    navagator
    .mozGetUserMedia(constrains)
    .then(success)
    .catch(error);
    } else if (navigator.getUserMedia) {
    //旧版API
    navigator
    .getUserMedia(constrains)
    .then(success)
    .catch(error);
    }
}
function initStream(constrains, success, error){
    if (
        navigator.mediaDevices.getUserMedia ||
        navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia
        ) {
        //调用用户媒体设备，访问摄像头
        
        //调用用户媒体设备，访问摄像头
        getUserMedia(constrains, success, error);
        } else {
        alert("你的浏览器不支持访问用户媒体设备");
        }
}
let zeroRTC;
// zeroRTC用来封装ws连接
class ZeroRTCEngine{
    constructor(wsUrl){
        // 设置websocket URL
        this.wsUrl=wsUrl,
        // ws对象
        this.signaling=null
        this.createWebsocket()
    }
    // 发起连接到服务器
    createWebsocket(){
        this.signaling = new WebSocket(this.wsUrl);
        this.signaling.onopen=((ev)=>{
            this.onOpen(ev);
        })
        this.signaling.onmessage=((ev)=>{
            this.onMessage(ev);
        })
        this.signaling.onerror=((ev)=>{
            this.onError(ev);
        })
        this.signaling.onclose=((ev)=>{
            this.onClose(ev);
        })
    }
    // 下4条都是监听服务器得到ev后的响应
    onOpen(){
        console.log('已经连上服务器');
        console.log('websocket open');
        join.addEventListener("click",()=>{
            // 检查输入正不正常
            console.log('申请加入房间');
            if(!ROOMID.value){
                app.lastElementChild.innerHTML="请输入roomId!"
                return;
            }
            roomId=ROOMID.value
            app.lastElementChild.innerHTML="";
            // // 打开摄像头，申请加入房间
            console.log('打开本地摄像头');
            initStream(constrains, success, error);

            // 细节：必须先获取媒体流再连接服务器，为解决异步，将doJoin写到success中
            // doJoin(roomId)
            
            
        })
        leave.addEventListener("click",()=>{
            console.log('关闭本地摄像头,并申请离开房间');
            
              // 调用closeCamera函数来关闭摄像头
            closeCamera();
            
            doLeave(roomId)
        })
    }
    onMessage(ev){
        console.log('onMessage: '+ev.data);
        const jsonMsg=JSON.parse(ev.data)
        switch(jsonMsg.cmd){
            case SIGNAL_TYPE_JOIN:
                handleMyJoin(jsonMsg);
                break;
            case SIGNAL_TYPE_NEW_PEER:
                handleRemoteNewPeer(jsonMsg);
                break;
            case SIGNAL_TYPE_RESP_JOIN:
                handleRemoteRESPJOIN(jsonMsg);
                break;
            case SIGNAL_TYPE_PEER_LEAVE:
                handleRemotePEERLEAVE(jsonMsg);
                break;
            case SIGNAL_TYPE_OFFER:
                handleRemoteOffer(jsonMsg);
                break;
            case SIGNAL_TYPE_ANSWER:
                handleRemoteAnswer(jsonMsg);
                break;
            case SIGNAL_TYPE_CANDIDATE:
                handleRemoteCandidate(jsonMsg);
                break;
        }
    }
    onError(ev){
        console.log('onError: '+ev.data);
    }
    onClose(ev){
        console.log('onClose->code: '+ev.code+",reason: "+EventTarget.reason);
    }

    // ws对服务器发送信息
    sendMsg(message){
        this.signaling.send(message);
    }
}
zeroRTC=new ZeroRTCEngine("ws://127.0.0.1:7777")

function createPeerConnection(remoteUid){
    // 配置coturn服务器，设置stun/turn规则
    let defaultConfiguration={
        bundlePolicy:"max-bundle",
        rtcpMuxPolicy:"require",
        iceTransportPolicy:"relay", //relay，只转发；all,打洞失败时转发
        // coturn配置
        iceServers:[
            {
                "urls":[
                    "turn:8.134.73.52:3478?transport=udp",
                    "turn:8.134.73.52:3478?transport=tcp",
                ],
                "username":"ihci",
                "credential":"ihci"
            },
            {
                "urls":[
                    "stun:8.134.73.52:3478"
                ]
            }
        ]
    }

    pc = new RTCPeerConnection(defaultConfiguration);
        pc.onicecandidate = function(event) {
            handleIceCandidate(event, remoteUid); // Pass remoteUid as an argument to handleIceCandidate
        };
        pc.ontrack = handleRemoteStreamAdd;
        localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
}

function handleIceCandidate(ev,rUid){
    // 请求stun
    console.log(rUid);
    
    console.log('handleIceCandidate');
    if (ev.candidate) {
        const jsonMsg = {
            'cmd': SIGNAL_TYPE_CANDIDATE,
            'roomId': roomId,
            'uid': localUserId,
            'remoteUid': rUid,
            'msg': JSON.stringify(ev.candidate) 
        };
        // console.log(jsonMsg);
        
        const mes = JSON.stringify(jsonMsg)
        zeroRTC.sendMsg(mes);
        console.log('已发送请求连接：' + mes);
    } else {
        // stun失败
        console.log("停止连接");
    }
}
function handleRemoteStreamAdd(ev){
    console.log('本地流添加成功');
    const remoteStream=ev.streams[0];
    remoteVideo.srcObject=remoteStream
    
}

function handleCreateOfferError(error){
    console.log('offer发送失败'+error);
} 
function createAnswerAndSendMessage(session){
    pc.setLocalDiscription(session)
    .then(()=>{
        
    })
    .catch((error)=>{
        console.error("发送answer失败"+error);
    });
}
function handleCreateAnswerError(error){
    console.error('answer发送失败'+error);
}
// 关闭双方连接
function hangup(){
    // 将对方的视频流关闭
    remoteVideo.srcObject=null
    // pc置null只是自己不会接收对端的信息，但是自己的流依然在传给对端
    // 一定要先close才能置null
    if(pc!=null){
        pc.close()
        pc=null;
    }
    
}



//以下为浏览器向服务器发命令
function doJoin(roomId){//join房间，发送
    // 发起连接
    const jsonMsg={
        'cmd':SIGNAL_TYPE_JOIN,
        'roomId':roomId,
        'uid':localUserId,
    }
    const mes=JSON.stringify(jsonMsg)
    zeroRTC.sendMsg(mes);
    // console.info()
}
function doLeave(roomId){//leave房间，发送
    // 发起关闭连接
    const jsonMsg={
        'cmd':SIGNAL_TYPE_LEAVE,
        'roomId':roomId,
        'uid':localUserId,
    }
    const mes=JSON.stringify(jsonMsg)
    zeroRTC.sendMsg(mes);

    // 离开时一定要将pc关闭，否则下次对方连不上
    pc.close()
    pc=null;
}

// 以下为浏览器向对端浏览器连接
function doOffer(remoteUid){
    console.log(remoteUid);
    
    // 创建peerConnection
    if(pc==null){
        createPeerConnection(remoteUid);
    }


    pc.createOffer()
        .then(session => {
        pc.setLocalDescription(session);
        const jsonMsg = {
            'cmd': SIGNAL_TYPE_OFFER,
            'roomId': roomId,
            'uid': localUserId,
            'remoteUid':remoteUid,
            'msg': JSON.stringify(session)
        };

            const mes=JSON.stringify(jsonMsg)
            zeroRTC.sendMsg(mes);
            console.log('已发送连接请求');
        })
        .catch(handleCreateOfferError);

}
function doAnswer(remoteUid){
    pc.createAnswer().then(session => {
        pc.setLocalDescription(session);
        const jsonMsg = {
            'cmd': SIGNAL_TYPE_ANSWER,
            'roomId': roomId,
            'uid': localUserId,
            'remoteUid':remoteUid,
            'msg': JSON.stringify(session)
            };
        const mes=JSON.stringify(jsonMsg)
        zeroRTC.sendMsg(mes);
        console.log('已发送连接请求');
    }).catch(handleCreateAnswerError)
}




// 以下为浏览器接收到服务器或对端的message响应后的处理
function handleMyJoin(message){
    console.info(message.mes)
    if(message.state==1){//已在房间
        
    }
    else if(message.state==2){//满人，不能进入房间
        //调用关闭摄像头？
        closeCamera();
        return
    }
    localVideo.play();
    // 打开摄像头
    // 打开摄像头，申请加入房间
    // console.log('打开本地摄像头');
    // 发现bug：如果等到服务器允许加入房间再打开视频流，这时房间的其他用户的offer可能先来到，就无法将媒体信息answer回去
    // 因此，要想视频通信，必须先获取到视频流，(可以先不打开
    // initStream(constrains, success, error);
}
function handleRemoteNewPeer(message){
    console.info("新加入房间者,uid: "+message.remoteUid);
    remoteUserId.push(message.remoteUid);
    console.log('当前用户：'+localUserId+remoteUserId);

    // 一旦有新的用户加进来，就和他建立通信
    console.log(message.remoteUid);
    
    doOffer(message.remoteUid);
}
function handleRemoteRESPJOIN(message){
    console.info("原已在房间者,uid: "+message.remoteUid);
    remoteUserId.push(message.remoteUid);
    console.log('当前用户：'+localUserId+remoteUserId);
}
function handleRemotePEERLEAVE(message){
    console.info("用户: "+message.remoteUid+"离开了房间");
    remoteUserId.splice(remoteUserId.indexOf(message.remoteUid),1);
    console.log('当前用户：'+localUserId+remoteUserId);
    hangup()
}
function handleRemoteOffer(message){
    console.log('接收到远程浏览器的offer');
    if (localStream == null) {
        console.error("本地视频流尚未准备好。");
        return;
    }
    
    if (pc == null) {
        createPeerConnection(message.uid);
    }

    let desc = JSON.parse(message.msg);
    pc.setRemoteDescription(new RTCSessionDescription(desc))
    .then(() => {
        // 成功设置远程的 Session Description，继续发送 Answer
        
        doAnswer(message.uid);
    })
    .catch((error) => {
        console.error('设置远程Session Description时出错：', error);
    });
}
function handleRemoteAnswer(message){
    console.log('接收到远端浏览器的answer');
    let desc =JSON.parse(message.msg);
    pc.setRemoteDescription(new RTCSessionDescription(desc))
    .then(() => {
      // 成功设置远程的 Session Description，继续 ICE candidate 的交换和收集等操作
      pc.onicecandidate = handleIceCandidate
    })
    .catch((error) => {
      console.error('设置远程Session Description时出错：', error);
    });
    
}
function handleRemoteCandidate(message){
    console.log('接收到远端的candidate');
    let candidate=JSON.parse(message.msg)
    pc.addIceCandidate(candidate).catch((e)=>{
        console.error("添加candidate失败:"+error);
    })

}




