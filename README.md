# webrtc_test
# 参考视频：https://www.bilibili.com/video/BV1D14y1W7qp

# 使用原生js写的前后端，client文件夹用nginx托管，server用nginx反向代理；由于是原生js简单模拟，ip、port等配置未解耦
# 当前实现了两个client通过server组成房间，实时视频通话

# 简单解释：client代码在浏览器运行，服务器的server进程提供房间接口，维持client之间的交流
# 通过server，client得知对方要和自己建立视频通话，两边同时使用webrtc协议向coturn服务器(docker一键部署)请求stun/turn服务实现内网穿透

# server只是让两边的信息同步，真正构建视频流信道的是client的peerconnection以及负责中转的coturn
# 类似tcp：A---offer-->B,B---answer-->A,A---media-->B,只不过是两边同时进行，最终是A---media-->B && B---media-->A,就实现了视频通话

# webrtc是1对1的，如果要多人视频通话，是不是就要每个client维护多个peerconnection？这样会对用户的带宽占用很多，而且如果stun不成功每个peerconnection都走turn，吃服务器的带宽是O(n^2)级。
