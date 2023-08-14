// 统一命令名
const SIGNAL_TYPE_JOIN="join"; //浏览器->服务器,加入房间;服务器->浏览器，加入结果
const SIGNAL_TYPE_RESP_JOIN="resp-join"; //服务器->浏览器，房间已有谁
const SIGNAL_TYPE_LEAVE="leave"; //浏览器->服务器，请求离开房间
const SIGNAL_TYPE_NEW_PEER="new-peer"; //服务器->浏览器，新加入的谁
const SIGNAL_TYPE_PEER_LEAVE="peer-leave"; //服务器->浏览器，谁离开了房间
const SIGNAL_TYPE_OFFER="offer"; //
const SIGNAL_TYPE_ANSWER="answer";
const SIGNAL_TYPE_CANDIDATE="candidate";
const USER_max=3;
const port=7777

// 导包，定义
const ws=require("nodejs-websocket")
// const { ZeroRTCMap }=require("./rooms/Map.js")
// 这是一个大数组,存Maps
class ZeroRTCMap {
    constructor() {
        this._entrys = new Array();
        // 插入
        this.put = function (key, value) {
            if (key == null || key == undefined) {
                return;
            }
            var index = this._getIndex(key);
            if (index == -1) {
                var entry = new Object();
                entry.key = key;
                entry.value = value;
                this._entrys[this._entrys.length] = entry;
            } else {
                this._entrys[index].value = value;
            }
        };
        // 根据key获取value
        this.get = function (key) {
            var index = this._getIndex(key);
            return (index != -1) ? this._entrys[index].value : null;
        };
        // 移除key-value
        this.remove = function (key) {
            var index = this._getIndex(key);
            if (index != -1) {
                this._entrys.splice(index, 1);
            }
        };
        // 清空map
        this.clear = function () {
            this._entrys.length = 0;
        };
        // 判断是否包含key
        this.contains = function (key) {
            var index = this._getIndex(key);
            return (index != -1) ? true : false;
        };
        // map内key-value的数量
        this.size = function () {
            return this._entrys.length;
        };
        // 获取所有的key
        this.getEntrys = function () {
            return this._entrys;
        };
        // 内部函数
        this._getIndex = function (key) {
            if (key == null || key == undefined) {
                return -1;
            }
            var _length = this._entrys.length;
            for (var i = 0; i < _length; i++) {
                var entry = this._entrys[i];
                if (entry == null || entry == undefined) {
                    continue;
                }
                if (entry.key === key) { // equal
                    return i;
                }
            }
            return -1;
        };
    }
}
class Client {
    constructor(uid, conn, roomId) {
        this.uid = uid; // 用户所属的id
        this.conn = conn; // uid对应的websocket连接
        this.roomId = roomId;
        console.log('uid:' + uid + ', conn:' + conn + ', roomId: ' + roomId);
    }
}

// let user=0;

// 定义所有房间对象{roomid,{uid}}
const roomMaps=new ZeroRTCMap()
// 为了用户离开时能快速找到房间踢出他，再使用一个map记录conn和room的映射
const clients=new ZeroRTCMap()

// 处理用户加入房间的请求
async function handleJoin(message,conn){
    const roomId=message.roomId;
    const uid=message.uid;
    console.info('用户: '+uid+" 尝试加入房间 "+roomId);
    
    let room=roomMaps.get(roomId);
    // 房间是否存在
    if(room==null){
        // 再开一个map，用来存具体房间的信息
        room=new ZeroRTCMap()
        roomMaps.put(roomId,room);
        console.log('新建房间，房间号：'+roomId); 
    }
    // 用户已在房间，禁用进入
    if(room.get(uid)!=null){
        console.log('用户'+uid+"已在房间了");
        let jsonMsg={
            'cmd': SIGNAL_TYPE_JOIN,
            'state': 1,
            'mes':"你已经在房间了"
        }
        let mes=JSON.stringify(jsonMsg)
        conn.sendText(mes);
        return
    }
    // 存在房间，判断人数
    if(room.size()>=USER_max){
        let jsonMsg={
            'cmd': SIGNAL_TYPE_JOIN,
            'state': 2,
            'mes':"房间已满人"
        }
        let mes=JSON.stringify(jsonMsg)
        conn.sendText(mes);
        return
    }
    
    // 此时允许加入
    // 保存用户的conn对象(非常重要)
    let newClient=new Client(uid,conn,roomId)
    await room.put(uid,newClient);
    // 封装所有用户信息
    clients.put(uid,newClient);//其实上面的room不用封装newClient,可以通过uid找到client，但是之前的已经写好了。。

    console.info("房间:"+roomId+" 新加入用户 : "+uid)
    let jsonMsg={
        'cmd': SIGNAL_TYPE_JOIN,
        'state': 0,
        'mes':"加入成功"
    }
    let mes=JSON.stringify(jsonMsg)
    conn.sendText(mes);
    if(room.size()>1){
        // 房间里面有其他人，通知其他人和这个人
        let Clients=room.getEntrys();
        // 对room中所有{uid:Client}
        for(let i in Clients){//每一个{uid:Client}
            let remoteUid=Clients[i].key;//获取key,即uid
            if(remoteUid!=uid){//不是新进来的user,告诉他们新来了uid
                let jsonMsg = {
                    'cmd': SIGNAL_TYPE_NEW_PEER,
                    'remoteUid': uid
                };
                let mes=JSON.stringify(jsonMsg)
                let remoteClient=room.get(remoteUid);
                remoteClient.conn.sendText(mes);

                // 同时也将这个remoteUid告诉刚进来的uid
                jsonMsg = {
                    'cmd': SIGNAL_TYPE_RESP_JOIN,
                    'remoteUid': remoteUid
                };
                mes=JSON.stringify(jsonMsg)
                let NewClient=room.get(uid);
                NewClient.conn.sendText(mes);
            }
        }
    } 
}
// 用户离开,删除clients和room的用户信息
function handleLeave(message){
    const roomId=message.roomId;
    const uid=message.uid;
    clients.remove(uid)
    console.info('用户: '+uid+"离开房间 "+roomId);
    //查询这个房间的Client
    let room=roomMaps.get(roomId);
    // 房间是否存在
    if(room==null){
        console.log('没有这个房间，房间会议已结束');
        return
    }
    // 存在房间，将他踢出房间
    room.remove(uid)
    // 然后,房间已空？
    if(room.size()==0){
        console.log('所有用户已离开，会议结束');
        roomMaps.remove(roomId)
        return
    }
    // 还有人，就告诉他们谁走了
    console.info("房间:"+roomId+" 用户 "+uid+'离开')
    let CLIENTS=room.getEntrys();
    // 对room中所有{uid:Client}
    for(let i in CLIENTS){//每一个{uid:Client}
        let remoteUid=CLIENTS[i].key;//获取key,即uid
        let jsonMsg = {
            'cmd': SIGNAL_TYPE_PEER_LEAVE,
            'remoteUid': uid
        };
        let mes=JSON.stringify(jsonMsg)
        let remoteClient=room.get(remoteUid);
        remoteClient.conn.sendText(mes);       
    }
}
function handleOffer(message){
    let roomId=message.roomId;
    let uid=message.uid;
    let remoteUid=message.remoteUid;

    console.log('Offering:   用户: '+uid+"尝试连接 用户："+remoteUid);
    let room=roomMaps.get(roomId);
    //房间为空
    if(room==null){
        console.error("Offering:   连接失败,已无房间"+roomId);
        return
    }
    if(room.get(uid)==null){
        console.error("Offering:   连接失败，房间无用户"+uid);
        return
    }
    let remoteClient=room.get(remoteUid);
    if(remoteClient){
        // 原封不动的将offer给到remoteuid
        let msg=JSON.stringify(message);
        remoteClient.conn.sendText(msg);
    }else{
        console.error("Offering:   无法找到用户"+remoteUid);
    }
}
function handleAnswer(message){
    let roomId=message.roomId;
    let uid=message.uid;
    let remoteUid=message.remoteUid;

    console.log('Answering:   用户: '+uid+"尝试回连 用户："+remoteUid);
    let room=roomMaps.get(roomId);
    //房间为空
    if(room==null){
        console.error("Answering:   连接失败,已无房间"+roomId);
        return
    }
    if(room.get(uid)==null){
        console.error("Answering:   连接失败，房间无用户"+uid);
        return
    }
    let remoteClient=room.get(remoteUid);
    if(remoteClient){
        // 原封不动的将Answer给到remoteuid
        let msg=JSON.stringify(message);
        remoteClient.conn.sendText(msg);
    }else{
        console.error("Answering:   无法找到用户"+remoteUid);
    }

}
function handleIceCandidate(message){
    let roomId=message.roomId;
    let uid=message.uid;
    let remoteUid=message.remoteUid;

    console.log('Candidating:   用户: '+uid+"尝试连接 用户："+remoteUid);
    let room=roomMaps.get(roomId);
    //房间为空
    if(room==null){
        console.error("Candidating:   连接失败,已无房间"+roomId);
        return
    }
    if(room.get(uid)==null){
        console.error("Candidating:   连接失败，房间无用户"+uid);
        return
    }
    let remoteClient=room.get(remoteUid);
    if(remoteClient){
        // 原封不动的将candidate给到remoteuid
        let msg=JSON.stringify(message);
        remoteClient.conn.sendText(msg);
    }else{
        console.error("Candidating:   无法找到用户"+remoteUid);
    }
}



// 创建一个连接
const server=ws.createServer((conn)=>{
    console.log('创建一个新的连接。。。');

    // conn.sendText("服务器已收到连接")
    conn.on("text",(str)=>{
        console.info('收到'+str);
        // 接收、解析客户data
        const jsonMsg=JSON.parse(str);
        // conn.client=null
        switch (jsonMsg.cmd){
            case SIGNAL_TYPE_JOIN:
                // 保存用户conn对象，检查用户的连接请求Msg
                // 在用户离开时，需要用到conn的Client信息(roomId等)从而修改房间情况，因此需要在用户加入房间后维护client信息
                handleJoin(jsonMsg,conn);
                break;
            case SIGNAL_TYPE_LEAVE:
                handleLeave(jsonMsg);
                break;
            case SIGNAL_TYPE_OFFER:
                handleOffer(jsonMsg);
                break;
            case SIGNAL_TYPE_ANSWER:
                handleAnswer(jsonMsg);
                break;
            case SIGNAL_TYPE_CANDIDATE:
                handleIceCandidate(jsonMsg);
                break;
        }
    })

    // user++;
    // conn.nickname="user"+user;
    // conn.fd="user"+user
    // const mes={};
    // mes.type="enter";
    // mes.data=conn.nickname+"进来了";
    // broadcast(JSON.stringify(mes));

    
    conn.on("close",(code,reason)=>{
        console.info("连接关闭code: "+code+",reason: "+reason);
        // 当用户离开时，扫描所有用户，删除不在的用户(暴力遍历)(可以改二分吗?)
        let CLIENTS=clients.getEntrys()
        for (let i in  CLIENTS) {
            if (CLIENTS[i].value.conn === conn) {
              console.log('Leaving client found:', CLIENTS[i].value.uid);
            //   复用"用户离开函数":handleLeave:
              let message={roomId:CLIENTS[i].value.roomId,uid:CLIENTS[i].value.uid}
              handleLeave(message)
              break;
            }
          }

        
        // if(conn.client!=null){
        //     let message={roomId:conn.client.roomId,uid:conn.client.uid}
        //     handleLeave(message)
        // }
        
        })
        
        conn.on("error",(err)=>{
            console.info('监听到错误'+err);
        })
}).listen(port);

function broadcast(str){
    server.connections.forEach((connection)=>{
        connection.sendText(str);
    })
}