https = require 'https'
WebSocket = require 'ws'
dailyCasting = require './libs/qqbot-daily-casting.coffee'
randomCasting = require './libs/random-casting.coffee'

OP_DISPATCH = 0
OP_HEARTBEAT = 1
OP_IDENTIFY = 2
OP_RECONNECT = 7
OP_INVALID_SESSION = 9
OP_HELLO = 10
OP_HEARTBEAT_ACK = 11
GROUP_AND_C2C_EVENT = 1 << 25
ROOMS_URL = 'https://www.jinrou.icu/rooms'
SITE_URL = 'https://www.jinrou.icu'

accessToken = null
accessTokenExpiresAt = 0
ws = null
heartbeatTimer = null
lastSeq = null
reconnectTimer = null
# 只对新配役指令防重，避免重复事件再次生成不同名单。
castingMessages = new Map

exports.start = ->
    config = Config.qqbot
    unless config?.enable
        return
    unless config.appID && config.appSecret
        console.error '[QQBot] appID and appSecret are required.'
        return
    # 定时主动发送不依赖网关连接状态，沿用开局通知的目标群配置。
    dailyCasting.start config, (-> getGroupOpenIDs config), (groupOpenID, content)->
        sendTextGroupMessage groupOpenID, content, config
    connectGateway config
        .catch (err)->
            console.error '[QQBot] Failed to connect gateway.'
            console.error err.stack || err

exports.sendGroupMessage = (content, keyboard)->
    config = Config.qqbot
    groupOpenIDs = getGroupOpenIDs config
    return Promise.resolve [] unless config?.enable && groupOpenIDs.length > 0
    return Promise.reject new Error '[QQBot] appID and appSecret are required.' unless config.appID && config.appSecret

    getAccessToken(config).then (token)->
        sends = groupOpenIDs.map (groupOpenID)->
            body =
                msg_type: 2
                markdown:
                    content: content
            body.keyboard = keyboard if keyboard?
            requestJSON {
                hostname: apiHost config
                path: "/v2/groups/#{encodeURIComponent groupOpenID}/messages"
                method: 'POST'
                headers:
                    Authorization: "QQBot #{token}"
            }, body
        Promise.all sends

# 与既有开局播报共用群列表解析，兼容旧的单群 groupOpenID 配置。
getGroupOpenIDs = (config)->
    groupOpenIDs = config?.groupOpenIDs
    if !groupOpenIDs? || (Array.isArray(groupOpenIDs) && groupOpenIDs.length == 0)
        groupOpenIDs = config?.groupOpenID
    groupOpenIDs = [groupOpenIDs] unless Array.isArray groupOpenIDs
    groupOpenIDs = groupOpenIDs.map (groupOpenID)-> String(groupOpenID ? '').trim()
    groupOpenIDs = groupOpenIDs.filter (groupOpenID)-> groupOpenID.length > 0
    groupOpenIDs

# 新功能使用纯文本，不改变既有开局播报的 Markdown 和按钮。
sendTextGroupMessage = (groupOpenID, content, config, msgID)->
    getAccessToken(config).then (token)->
        body = {msg_type: 0, content}
        if msgID?
            body.msg_id = msgID
            body.msg_seq = 1
        requestJSON {
            hostname: apiHost config
            path: "/v2/groups/#{encodeURIComponent groupOpenID}/messages"
            method: 'POST'
            headers:
                Authorization: "QQBot #{token}"
        }, body

connectGateway = (config)->
    getAccessToken(config)
        .then (token)->
            getGateway token
                .then (gateway)->
                    openWebSocket gateway.url, token, config

openWebSocket = (url, token, config)->
    ws = new WebSocket url
    ws.on 'message', (data)->
        handleGatewayMessage data, token, config
    ws.on 'close', (code, reason)->
        console.error "[QQBot] websocket closed: #{code} #{reason}"
        clearHeartbeat()
        reconnectLater config
    ws.on 'error', (err)->
        console.error '[QQBot] websocket error.'
        console.error err.stack || err

handleGatewayMessage = (data, token, config)->
    try
        payload = JSON.parse data
    catch err
        console.error '[QQBot] Failed to parse websocket payload.'
        console.error err.stack || err
        return
    lastSeq = payload.s if payload.s?
    switch payload.op
        when OP_HELLO
            startHeartbeat payload.d.heartbeat_interval
            identify token
        when OP_DISPATCH
            handleDispatch payload.t, payload.d, config
        when OP_RECONNECT
            reconnectNow config
        when OP_INVALID_SESSION
            reconnectLater config
        when OP_HEARTBEAT_ACK
            return

identify = (token)->
    sendGateway
        op: OP_IDENTIFY
        d:
            token: "QQBot #{token}"
            intents: GROUP_AND_C2C_EVENT
            shard: [0, 1]
            properties:
                os: process.platform
                browser: 'jinrou'
                device: 'jinrou'

startHeartbeat = (interval)->
    clearHeartbeat()
    heartbeatTimer = setInterval (->
        sendGateway
            op: OP_HEARTBEAT
            d: lastSeq
    ), interval

clearHeartbeat = ->
    if heartbeatTimer?
        clearInterval heartbeatTimer
        heartbeatTimer = null

sendGateway = (payload)->
    if ws? && ws.readyState == WebSocket.OPEN
        ws.send JSON.stringify payload

handleDispatch = (eventType, eventData, config)->
    if eventType == 'GROUP_AT_MESSAGE_CREATE'
        replyToGroupAtMessage eventData, config

replyToGroupAtMessage = (eventData, config)->
    groupOpenID = eventData.group_openid
    msgID = eventData.id
    unless groupOpenID && msgID
        console.error '[QQBot] GROUP_AT_MESSAGE_CREATE is missing group_openid or id.'
        return
    console.log '[QQBot] group_openid =', groupOpenID
    text = String(eventData.content ? '').trim()
    if /^[\/／]?使绊子(?:\s|$)/.test text
        replyToRandomCasting groupOpenID, msgID, text, config
        return
    buildWaitingRoomsMessage()
        .then (content)->
            replyGroupMessage groupOpenID, msgID, content, config
        .then (result)->
            console.log '[QQBot] Replied room list to group mention.', result
        .catch (err)->
            console.error '[QQBot] Failed to reply group mention.'
            console.error err.stack || err

replyToRandomCasting = (groupOpenID, msgID, text, config)->
    now = Date.now()
    castingMessages.forEach (receivedAt, key)->
        castingMessages.delete key if now - receivedAt >= 5 * 60 * 1000
    key = "#{groupOpenID}:#{msgID}"
    return if castingMessages.has key
    castingMessages.set key, now

    # QQ 指令面板和手动 @ 都进入同一群消息事件；回复绑定原消息，
    # 不广播到配置的其他群，也不需要主动消息额度。
    Promise.resolve().then ->
        match = text.match /^[\/／]?使绊子(?:\s+([0-9]+))?$/
        number = if match?[1]? then Number match[1] else undefined
        # 不带参数走推荐权重；带参数只校验游戏支持的范围，直接按该人数生成。
        unless match? && (!number? || randomCasting.minPlayers <= number <= randomCasting.maxPlayers)
            return "用法：/使绊子（按流程随机12–30人），或 /使绊子 9（指定#{randomCasting.minPlayers}–#{randomCasting.maxPlayers}人）。"
        randomCasting.buildMessage number
    .catch (err)->
        console.error '[QQBot] Failed to generate random casting.'
        console.error err.stack || err
        '生成名单失败，请稍后再试。'
    .then (content)->
        sendTextGroupMessage groupOpenID, content, config, msgID
    .catch (err)->
        console.error '[QQBot] Failed to reply random casting.'
        console.error err.stack || err

replyGroupMessage = (groupOpenID, msgID, content, config)->
    getAccessToken(config).then (token)->
        requestJSON {
            hostname: apiHost config
            path: "/v2/groups/#{encodeURIComponent groupOpenID}/messages"
            method: 'POST'
            headers:
                Authorization: "QQBot #{token}"
        }, {
            content: content
            msg_type: 2
            markdown:
                content: content
            msg_id: msgID
            msg_seq: 1
            keyboard: roomListKeyboard()
        }

buildWaitingRoomsMessage = ->
    new Promise (resolve, reject)->
        freshTime = Date.now() - Config.rooms.fresh * 60 * 60 * 1000
        M.rooms.find({
            mode:
                $in: ['waiting', 'playing']
            made:
                $gt: freshTime
        }).sort({made: -1}).limit(50).toArray (err, rooms)->
            if err?
                reject err
                return
            rooms = sortRoomsForMessage rooms
            rooms = rooms.slice 0, 20
            unless rooms.length
                resolve '\n📢📢📢下村下村📢📢📢\n暂无募集或对战中的房间。'
                return
            resolve "\📢📢📢下村下村📢📢📢\n#{rooms.map(formatRoomLine).join '\n'}"

sortRoomsForMessage = (rooms)->
    rooms.sort (a, b)->
        modeOrder(a.mode) - modeOrder(b.mode) || b.made - a.made

modeOrder = (mode)->
    switch mode
        when 'waiting' then 0
        when 'playing' then 1
        else 2

formatRoomLine = (room)->
    players = room.players ? []
    "#{formatRoomMode room.mode} (#{players.length}人/#{room.number}人) #{room.name}"

formatRoomMode = (mode)->
    switch mode
        when 'waiting' then '募集中'
        when 'playing' then '对战中'
        else mode

roomListKeyboard = ->
    content:
        rows: [
            {
                buttons: [
                    {
                        id: 'rooms'
                        render_data:
                            label: '访问房间列表'
                            visited_label: '访问房间列表'
                            style: 1
                        action:
                            type: 0
                            permission:
                                type: 2
                            data: ROOMS_URL
                            unsupport_tips: ROOMS_URL
                    }
                ]
            }
        ]

roomKeyboard = (url, label)->
    content:
        rows: [
            {
                buttons: [
                    {
                        id: 'rooms'
                        render_data:
                            label: label
                            visited_label: label
                            style: 1
                        action:
                            type: 0
                            permission:
                                type: 2
                            data: url
                            unsupport_tips: url
                    }
                ]
            }
        ]

exports.gameRoomKeyboard = (roomID)->
    roomKeyboard "#{SITE_URL}/room/#{encodeURIComponent roomID}", '进入房间'

getGateway = (token)->
    requestJSON {
        hostname: apiHost Config.qqbot
        path: '/gateway'
        method: 'GET'
        headers:
            Authorization: "QQBot #{token}"
    }

getAccessToken = (config)->
    now = Date.now()
    if accessToken? && now < accessTokenExpiresAt - 60 * 1000
        return Promise.resolve accessToken
    requestJSON {
        hostname: 'bots.qq.com'
        path: '/app/getAppAccessToken'
        method: 'POST'
    }, {
        appId: String config.appID
        clientSecret: config.appSecret
    }
        .then (result)->
            unless result.access_token?
                throw new Error "QQ Bot access token response is invalid: #{JSON.stringify result}"
            accessToken = result.access_token
            expiresIn = parseInt(result.expires_in ? 7200, 10)
            accessTokenExpiresAt = Date.now() + Math.max(expiresIn - 60, 60) * 1000
            accessToken

requestJSON = (options, body)->
    new Promise (resolve, reject)->
        data = if body? then JSON.stringify body else null
        headers = Object.assign {}, options.headers ? {}
        if data?
            headers['Content-Type'] = 'application/json'
            headers['Content-Length'] = Buffer.byteLength data
        requestOptions =
            hostname: options.hostname
            path: options.path
            method: options.method
            headers: headers
        req = https.request requestOptions, (res)->
            chunks = []
            res.on 'data', (chunk)-> chunks.push chunk
            res.on 'end', ->
                text = Buffer.concat(chunks).toString 'utf8'
                result = null
                try
                    result = if text then JSON.parse text else {}
                catch err
                    reject new Error "QQ Bot returned non-JSON response: #{text}"
                    return
                if res.statusCode < 200 || res.statusCode >= 300
                    reject new Error "QQ Bot HTTP #{res.statusCode}: #{text}"
                    return
                resolve result
        req.on 'error', reject
        req.write data if data?
        req.end()

apiHost = (config)->
    if config?.sandbox then 'sandbox.api.sgroup.qq.com' else 'api.sgroup.qq.com'

reconnectNow = (config)->
    try
        ws?.close()
    catch err
        null
    clearHeartbeat()

reconnectLater = (config)->
    return if reconnectTimer?
    reconnectTimer = setTimeout (->
        reconnectTimer = null
        connectGateway config
            .catch (err)->
                console.error '[QQBot] Failed to reconnect gateway.'
                console.error err.stack || err
    ), 5000
