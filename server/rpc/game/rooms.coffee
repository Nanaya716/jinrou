libblacklist = require '../../libs/blacklist.coffee'
libuserlogs = require '../../libs/userlogs.coffee'
libi18n = require '../../libs/i18n.coffee'
libready = require '../../libs/ready.coffee'

i18n = libi18n.getWithDefaultNS 'rooms'

###
room: {
  id: Number
  name: String
  owner:{
    userid: Userid
    name: String
  }
  password: Hashed Password
  comment: String
  villageRules: String
  mode: "waiting"/"playing"/"end"
  made: Time(Number)(作成された日時）
  blind:""/"yes"/"complete"
  theme: String(主题房间，用于各种套皮活动)
  number: Number(プレイヤー数)
  players:[PlayerObject,PlayerObject,...]
  gm: Booelan(trueならオーナーGM)
  watchspeak: Boolean (trueなら観戦者の発言可）
  jobrule: String   //開始後はなんの配役か（エンドレス闇鍋用）
  ban: [String]  // kicked userid
}
PlayerObject.start=Boolean
PlayerObject.mode="player" / "gm" / "helper"
###
page_number=10

sanitizeRoomForList = (room, userid)->
    room.villageRules ?= ""
    if room.password?
        room.needpassword = true
        room.password = undefined
    if room.blind
        room.owner = undefined
    for p in room.players
        # find my player
        if p.realid == userid
            p.me = true
        p.realid = undefined
    unless room.watchspeak?
        # old rooms do not have watchspeak set.
        # watchspeak defaults to true.
        room.watchspeak = true
    if room.theme
        theme = Server.game.themes.getTheme room.theme
        unless theme == null
            room.themeFullName = theme.name
    room

normalizeFavoriteSearchText = (text)->
    String(text ? '').trim().toLowerCase()

favoriteResultText = (subtype)->
    switch subtype
        when "win"
            "胜利 win"
        when "lose"
            "败北 失败 lose"
        when "draw"
            "平局 draw"
        when "gm"
            "gm 游戏管理员"
        when "helper"
            "helper 帮手"
        else
            ""

favoriteSearchText = (room, gameinfo)->
    parts = [room.name ? ""]
    if gameinfo?
        parts.push gameinfo.job ? ""
        parts.push i18n.t "roles:jobname.#{gameinfo.job}" if gameinfo.job?
        parts.push favoriteResultText gameinfo.subtype
    normalizeFavoriteSearchText parts.join " "

# Collection of jobs to reset readiness.
readyResetJobCollection = new Map

module.exports=
    # サーバー用 部屋1つ取得
    oneRoomS:(roomid,cb)->
        M.rooms.findOne {id:roomid},(err,result)=>
            if err?
                cb {error:err}
                return
            unless result?
                cb result
                return
            if result.made < Date.now()-Config.rooms.fresh*3600000
                result.old=true
            result.villageRules ?= ""
            cb result

Server=
    game:
        game:require './game.coffee'
        rooms:module.exports
        themes:require './themes.coffee'
    oauth:require '../../oauth.coffee'
    log:require '../../log.coffee'
crypto=require 'crypto'
# ヘルパーセット処理
sethelper=(ss,roomid,userid,id,res)->
    Server.game.rooms.oneRoomS roomid,(room)->
        if !room || room.error?
            res i18n.t "error.noSuchRoom"
            return
        pl = room.players.filter((x)->x.realid==userid)[0]
        topl=room.players.filter((x)->x.userid==id)[0]
        if pl?.mode=="gm"
            res i18n.t "error.gmCannotBeHelper"
            return
        if pl?.userid == topl?.userid
            res i18n.t "error.noSelfHelper"
            return
        unless room.mode=="waiting"
            res i18n.t "error.alreadyStarted"
            return
        mode= if topl? then "helper_#{id}" else "player"
        room.players.forEach (x,i)=>
            if x.realid==userid
                M.rooms.update {
                    id: roomid
                    "players.realid": x.realid
                }, {
                    $set: {
                        "players.$.mode": mode
                    }
                }, (err)=>
                    if err?
                        res String err
                    else
                        res null
                        # 帮手の様子を 知らせる
                        if pl.mode!=mode
                            # 新しくなった
                            Server.game.game.helperlog ss,room,pl,topl
                            ss.publish.channel "room#{roomid}", "mode", {userid:x.userid,mode:mode}

module.exports.actions=(req,res,ss)->
    req.use 'user.fire.wall'
    req.use 'session'

    getRooms:(mode,page)->
        if mode=="log"
            query=
                mode:"end"
        else if mode=="my"
            query=
                mode:"end"
                "players.realid":req.session.userId
        else if mode=="old"
            # 古い部屋
            query=
                mode:
                    $ne:"end"
                made:
                    $lte:Date.now()-Config.rooms.fresh*3600000
        else
            # 新しい部屋
            query=
                mode:
                    $ne:"end"
                made:
                    $gt:Date.now()-Config.rooms.fresh*3600000

        M.rooms.find(query).sort({made:-1}).skip(page*page_number).limit(page_number).toArray (err,results)->
            if err?
                res {error:err}
                return
            results.forEach (x)->
                if x.password?
                    x.needpassword=true
                    delete x.password
                if x.blind
                    delete x.owner
                    x.players.forEach (p)->
                        delete p.realid
                unless x.watchspeak?
                    # old rooms do not have watchspeak set.
                    # watchspeak defaults to true.
                    x.watchspeak = true
                x.villageRules ?= ""
                if x.theme
                    theme = Server.game.themes.getTheme x.theme
                    unless theme == null
                        x.themeFullName = theme.name
            res results
    getMyRooms:(page)->
        # extract user's play logs from userrawlogs
        M.userrawlogs.aggregate [
            {
                $match:
                    userid: req.session.userId
                    type: libuserlogs.DataTypes.game
            }, {
                $sort:
                    gameid: -1
            }, {
                $skip: page * page_number
            }, {
                $limit: page_number
            }, {
            # join with room object
                $lookup:
                    from: "rooms"
                    localField: "gameid"
                    foreignField: "id"
                    as: "room"
            }, {
                $unwind: "$room"
            },
        ], (err, results)->
            if err?
                res {error: String err}
                return
            for x in results
                if x.room?
                    sanitizeRoomForList x.room, req.session.userId
            res results

    getFavoriteRooms:(page, filter = {})->
        unless req.session.userId
            res {error: i18n.t "common:error.needLogin"}
            return
        keyword = normalizeFavoriteSearchText(
            if typeof filter == "string" then filter else filter?.keyword
        )
        M.roomfavorites.find({
            userid: req.session.userId
        }).sort({createdAt: -1}).toArray (err, favorites)->
            if err?
                res {error: String err}
                return
            roomids = favorites.map (x)-> x.roomid
            unless roomids.length
                res []
                return
            M.userrawlogs.find({
                userid: req.session.userId
                type: libuserlogs.DataTypes.game
                gameid:
                    $in: roomids
            }).toArray (err, logs)->
                if err?
                    res {error: String err}
                    return
                logsByRoom = {}
                for log in logs
                    logsByRoom[log.gameid] = log
                M.rooms.find({
                    id:
                        $in: roomids
                }).toArray (err, rooms)->
                    if err?
                        res {error: String err}
                        return
                    roomsById = {}
                    for room in rooms
                        roomsById[room.id] = room
                    matched = []
                    for favorite in favorites
                        room = roomsById[favorite.roomid]
                        continue unless room?
                        gameinfo = logsByRoom[favorite.roomid]
                        if keyword && favoriteSearchText(room, gameinfo).indexOf(keyword) < 0
                            continue
                        matched.push {
                            room: sanitizeRoomForList room, req.session.userId
                            job: gameinfo?.job ? null
                            subtype: gameinfo?.subtype ? null
                        }
                    res matched.slice page * page_number, (page + 1) * page_number

    getFavoriteState:(roomid)->
        unless req.session.userId
            res {available: false, favorite: false}
            return
        M.rooms.findOne {id: roomid}, (err, room)->
            if err?
                res {error: String err}
                return
            unless room? && room.mode == "end"
                res {available: false, favorite: false}
                return
            M.roomfavorites.findOne {
                userid: req.session.userId
                roomid: roomid
            }, (err, doc)->
                if err?
                    res {error: String err}
                    return
                res {
                    available: true
                    favorite: !!doc
                }

    setFavoriteRoom:(roomid, favorite)->
        unless req.session.userId
            res {error: i18n.t("common:error.needLogin"), require:"login"}
            return
        M.rooms.findOne {id: roomid}, (err, room)->
            if err?
                res {error: String err}
                return
            unless room?
                res {error: i18n.t "error.noSuchRoom"}
                return
            unless room.mode == "end"
                res {error: "只能收藏已经结束的房间。"}
                return
            query =
                userid: req.session.userId
                roomid: roomid
            if favorite
                M.roomfavorites.update query, {
                    $setOnInsert:
                        userid: req.session.userId
                        roomid: roomid
                        createdAt: new Date
                }, {
                    upsert: true
                }, (err)->
                    if err?
                        res {error: String err}
                    else
                        res {favorite: true}
            else
                M.roomfavorites.remove query, (err)->
                    if err?
                        res {error: String err}
                    else
                        res {favorite: false}


    oneRoom:(roomid)->
        M.rooms.findOne {id:roomid},(err,result)=>
            if err?
                res {error:err}
                return
            # クライアントからの問い合わせの場合
            pl = result.players.filter((x)-> x.realid==req.session.userId)[0]
            result.players.forEach (p)->
                unless result.blind == "" || pl?.mode == "gm"
                    delete p.realid
                delete p.ip
            delete result.quitfromtheme
            # ふるいかどうか
            if result.made < Date.now()-Config.rooms.fresh*3600000
                result.old=true
            result.villageRules ?= ""
            # パスワードをアレする
            result.password = !!result.password
            if result.theme
                theme = Server.game.themes.getTheme result.theme
                unless theme == null
                    result.themeFullName = theme.name
            res result

    # 成功: {id: roomid}
    # 失敗: {error: ""}
    newRoom: (query)->
        unless req.session.userId
            res {error: i18n.t "common:error.needLogin"}
            return
        unless query.name?.trim?()
            res {error: i18n.t "error.newRoom.noName"}
            return
        if query.name.length > Config.maxlength.room.name
            res {error: i18n.t "error.newRoom.nameTooLong"}
            return
        if query.comment && query.comment.length > Config.maxlength.room.comment
            res {error: i18n.t "error.newRoom.commentTooLong"}
            return
        villageRules = query.villageRules ? ""
        if villageRules.length > Config.maxlength.room.villageRules
            res {error: i18n.t "error.newRoom.villageRulesTooLong"}
            return
        maxNumber = parseInt query.number, 10
        if maxNumber < 5
            res {error: i18n.t "error.newRoom.maxNumberTooSmall"}
            return
        unless query.blind in ['', 'yes', 'complete']
            res {error: i18n.t "error.newRoom.invalidParameter"}
            return
        unless libblacklist.checkPermission "play", req.session.ban
            res {error: i18n.t "error.newRoom.banned"}
            return

        M.rooms.find().sort({id:-1}).limit(1).nextObject (err,doc)=>
            id=if doc? then doc.id+1 else 1
            
            #在一定时间间隔内，同一用户不能连续建房
            minTimeInterval = 10
            if id>1 and doc.owner.userid==req.session.user.userid
                if (Date.now()-doc.made)<minTimeInterval
                    res {error: "您在#{((minTimeInterval-(Date.now()-doc.made))/1000).toFixed(0)}秒内不能连续建房。"}
                    return
            room=
                id:id   #ID連番
                name: query.name.trim()
                number: maxNumber
                mode:"waiting"
                players:[]
                made:Date.now()
                jobrule:null
            if room.number>40
                res {error: "拒绝40人以上超大房，从你我做起。"}
                return
            if room.name.length<1
                res {error: "请勿使用空格作为房间名。"}
                return
            if room.name.length>64
                res {error: "你是在开车吗？如果不是，请换一个更短的房间名；如果是，本服务器将拨打110。"}
                return
            room.password=query.password ? null
            room.blind=query.blind
            room.theme=query.theme
            # 匿名模式且无主题时，自动使用 openavatar（开放匿名主题）
            if room.blind in ['yes', 'complete'] && (!room.theme? or room.theme == '')
                room.theme = 'openavatar'
            if room.theme
                theme = Server.game.themes.getTheme room.theme
                unless theme
                    res {error: i18n.t "error.theme.noTheme"}
                    return
                if !theme.isAvailable?()
                    res {error: i18n.t "error.theme.notAvailable", {name: theme.name}}
                    return
                if !theme.lockable && room.password
                    res {error: i18n.t "error.theme.notLockable", {name: theme.name}}
                    return
                if room.blind == ""
                    res {error: i18n.t "error.theme.notBlind"}
                    return

                # OpenAvatar 模式不检查人数限制（角色来自所有主题）
                unless theme.openAvatar
                    skins = Object.keys theme.skins
                    if room.number > skins.length
                        res {error: i18n.t "error.theme.playerTooMuch", {
                            name: theme.name
                            length: skins.length
                        }}
                        return
            room.comment=query.comment ? ""
            room.villageRules=villageRules
            #unless room.blind
            #   room.players.push req.session.user
            unless room.number
                res {error: i18n.t "error.newRoom.invalidParameter"}
                return
            room.owner=
                userid:req.session.user.userid
                name:req.session.user.name
            room.gm = query.ownerGM=="yes"
            room.watchspeak = query.watchspeak == "on"
            if query.ownerGM=="yes"
                # GMがいる
                su=req.session.user
                room.players.push {
                    userid: req.session.user.userid
                    realid: req.session.user.userid
                    name:su.name
                    ip:su.ip
                    icon:su.icon
                    start:true
                    mode:"gm"
                    nowprize:null
                }
            M.rooms.insertOne room, {w: 1}, (err)->
                if err?
                    res {error: err}
                    return
                Server.game.game.newGame room,ss, (err)->
                    if err?
                        # TODO: revert?
                        res {error: err}
                        return
                    res {id: room.id}
                    # build options string
                    delimiter = i18n.t "tweet.newRoom.delimiter"
                    options = [
                        (if room.password then delimiter + i18n.t("tweet.newRoom.password") else ''),
                        (if room.blind then delimiter + i18n.t("tweet.newRoom.blind") else ''),
                        (if room.gm then delimiter + i18n.t("tweet.newRoom.gm") else ''),
                    ].join ''
                    tweet = i18n.t "tweet.newRoom.main", {
                        name: Server.oauth.sanitizeTweet room.name
                        id: room.id
                        options: options
                    }
                    Server.oauth.template room.id, tweet, Config.admin.password

                    Server.log.makeroom req.session.user, room

    # 部屋に入る
    # 成功ならnull 失敗なら错误メッセージ
    join: (roomid,opt)->
        unless req.session.userId
            res {error: i18n.t("common:error.needLogin"), require:"login"}    # ログインが必要
            return
        M.users.findOne {userid:req.session.userId},(err,doc)->
            unless doc?
                res {error:"请注册",require:"login"}    # 需要注册
                return
        unless libblacklist.checkPermission "play", req.session.ban
            # アクセス制限
            res {
                error: i18n.t "error.join.banned"
            }
            return

        #Function to sanitize log text.
        #Removes Unicode bidi characters.
        sanitizeName = (name)->
            return name.replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '')

        opt.name = sanitizeName opt.name

        Server.game.rooms.oneRoomS roomid,(room)=>
            if !room || room.error?
                res error: i18n.t "error.noSuchRoom"
                return
            if req.session.userId in (room.players.map (x)->x.realid)
                res error: i18n.t "error.join.alreadyJoined"
                return
            if Array.isArray(room.ban) && (req.session.userId in room.ban)
                res error: i18n.t "error.join.kicked"
                return
            if opt.name in (room.players.map (x)->x.name)
                res error: i18n.t "error.join.nameUsed", {name: opt.name}
                return
            if room.gm && room.owner.userid==req.session.userId
                res error: i18n.t "error.join.alreadyJoined"
                return
            unless room.mode=="waiting" || (room.mode=="playing" && room.jobrule=="特殊规则.Endless黑暗火锅")
                res error: i18n.t "error.alreadyStarted"
                return
            if room.mode=="waiting" && room.players.length >= room.number
                # 満員
                res error: i18n.t "error.join.full"
                return
            if room.mode=="playing" && room.jobrule=="特殊规则.Endless黑暗火锅"
                # エンドレス黑暗火锅の場合はゲーム内人数による人数判定を行う
                unless Server.game.game.endlessCanEnter(roomid, req.session.userId, room.number)
                    # 満員
                    res error: i18n.t "error.join.full"
                    return
            #room.players.push req.session.user
            su=req.session.user
            user=
                userid:req.session.userId
                realid:req.session.userId
                name:sanitizeName su.name.trim()
                ip:su.ip
                icon:su.icon
                start:false
                mode:"player"
                nowprize:su.nowprize
            # 同IP制限
                
            # if room.players.some((x)->x.ip==su.ip) && su.ip?.match("127.0.0.1")==null
            #     res error:"禁止多开 #{su.ip}"
            #     return
                
            # please no, link of data:image/jpeg;base64 would be a disaster
            if user.icon?.length > Config.maxlength.user.icon
                res error: i18n.t "error.join.iconTooLong"
                return

            if room.theme
                theme = Server.game.themes.getTheme room.theme
                if theme == null
                    res {error: i18n.t "error.theme.noTheme"}
                    return
                if !theme.isAvailable?()
                    res {error: i18n.t "error.theme.notAvailable", {name: theme.name}}
                    return
                if room.quitfromtheme? && room.quitfromtheme[req.session.userId]? && room.quitfromtheme[req.session.userId] + 0*1000 > Date.now()
                    res {error: i18n.t "error.theme.tooFrequent", {time: 0 + Math.floor((room.quitfromtheme[req.session.userId] - Date.now())/1000)}}
                    return

            if room.blind
                unless opt?.name || room.theme
                    res error: i18n.t "error.join.nameNeeded"
                    return
                if opt.name.length > Config.maxlength.user.name
                    res {error: i18n.t "error.join.nameTooLong"}
                    return
                # 分配皮肤
                if room.theme && theme != null
                    # OpenAvatar 跨主题选择模式
                    if theme.openAvatar
                        # 自定义模式：使用自定义名字和头像（头像可为空）
                        if opt.customName?
                            customName = opt.customName.trim()
                            # 检查名字是否已被使用
                            if room.players.some((pl)->pl.name==customName)
                                res error:"该名字已被使用，请选择其他名字。"
                                return
                            # 检查名字长度
                            if customName.length > Config.maxlength.user.name
                                res error:"名字太长了。"
                                return
                            user.name = customName
                            # customIcon 可以为空，如果提供了则使用
                            if opt.customIcon?
                                customIcon = opt.customIcon.trim()
                                user.icon = customIcon
                            # 生成随机用户ID
                            loop
                                user.userid=crypto.randomBytes(10).toString('hex')
                                if user.userid? and room.players.every((pl)->user.userid!=pl.userid)
                                    break
                            unless user.name? and user.name and user.userid? and user.userid
                                res error:"由于未知错误加入游戏失败，请重试。"
                                return
                        # opt.selectedSkin 格式: { theme: "themeName", skinKey: "skinKey" }
                        else if opt.selectedSkin?.theme and opt.selectedSkin?.skinKey
                            # 用户主动选择角色（包括手动选择和随机后选择）
                            selectedTheme = Server.game.themes.getTheme opt.selectedSkin.theme
                            if selectedTheme and selectedTheme.skins and selectedTheme.skins[opt.selectedSkin.skinKey]
                                selectedSkin = selectedTheme.skins[opt.selectedSkin.skinKey]
                                # 检查角色名是否已被使用
                                if room.players.some((pl)->pl.name==selectedSkin.name)
                                    res error:"该角色已被选择，请选择其他角色。"
                                    return
                                user.name = selectedSkin.name.trim()
                                avatar = selectedSkin.avatar
                                if Array.isArray avatar
                                    avatar = avatar[Math.floor(Math.random() * avatar.length)]
                                user.icon = avatar ? null
                                # 保存称号用于后续
                                theme._selectedPrize = selectedSkin.prize
                                theme._selectedSkinName = opt.selectedSkin.skinKey
                                theme._selectedThemeName = opt.selectedSkin.theme
                                # 生成随机用户ID
                                loop
                                    user.userid=crypto.randomBytes(10).toString('hex')
                                    if user.userid? and room.players.every((pl)->user.userid!=pl.userid)
                                        break
                                unless user.name? and user.name and user.userid? and user.userid
                                    res error:"由于未知错误加入游戏失败，请重试。"
                                    return
                            else
                                res error:"选择的角色不存在，请重试。"
                                return
                        else
                            # 没有选择角色，返回错误
                            res error:"请先选择一个角色或自定义。"
                            return
                    else
                        # 原有的单一主题角色分配逻辑
                        skins = Object.keys theme.skins
                        skins = skins.filter((x)->!room.players.some((pl)->theme.skins[x].name==pl.name))
                        skin = skins[Math.floor(Math.random() * skins.length)]

                        unless skin
                            res error:"由于未知错误加入游戏失败，请重试。"
                            return

                        user.name=theme.skins[skin].name.trim()
                        loop
                            user.userid=crypto.randomBytes(10).toString('hex')
                            if user.userid? && room.players.every((pl)->user.userid!=pl.userid)
                                break
                        unless user.name? && user.name && user.userid? && user.userid
                            res error:"由于未知错误加入游戏失败，请重试。"
                            return
                        avatar = theme.skins[skin].avatar
                        # 也可能是 Array
                        if Array.isArray avatar
                            avatar = avatar[Math.floor(Math.random() * avatar.length)]
                        user.icon= avatar ? null

                    # 生成随机用户ID（OpenAvatar和普通主题都需要）
                    loop
                        user.userid=crypto.randomBytes(10).toString('hex')
                        if user.userid? && room.players.every((pl)->user.userid!=pl.userid)
                            break
                    unless user.name? && user.name && user.userid? && user.userid
                        res error:"由于未知错误加入游戏失败，请重试。"
                        return
                # 匿名模式
                else
                    makeid=->   # ID生成
                        re=""
                        while !re
                            i=0
                            while i<20
                                re+="0123456789abcdef"[Math.floor Math.random()*16]
                                i++
                            if room.players.some((x)->x.userid==re)
                                re=""
                        re
                    user.name=sanitizeName opt.name.trim()
                    user.userid=makeid()
                    user.icon= opt.icon ? null
                    
            #同昵称限制,及禁止使用替身君做昵称
            if room.players.some((x)->x.name==user.name)
                res error:"昵称 #{user.name} 已经存在"
                return
            if user.name=="替身君"
                res error:"禁止冒名顶替「替身君」"
                return
            if user.name.length<1
                res error: i18n.t "error.join.nameOnlySpaces"
                return
            if room.players.some((x)->x.realid==user.realid)
                res error:"#{user.realid} 正在尝试重复加入游戏，请检查您的网络连接是否正常稳定。"
                return

            M.rooms.update {id:roomid},{$push: {players:user}},(err)=>
                if err?
                    res error: String err
                else
                    # 啊啦，为什么身上有一张身份证，这就是我吗？
                    if room.theme && theme != null
                        # 指明玩家的皮肤
                        if theme.openAvatar
                            # OpenAvatar 模式：使用保存的称号（自定义模式没有称号）
                            pr = theme._selectedPrize
                        else
                            # 普通主题模式
                            pr = theme.skins[skin].prize

                        # 也可能是 Array
                        if Array.isArray pr
                            pr = pr[Math.floor(Math.random() * pr.length)]
                        # 传递称号
                        if pr
                            user.tpr = pr
                            name = "「#{user.tpr}」#{user.name}"
                        else
                            name = "#{user.name}"
                        # 清除临时保存的数据
                        if theme.openAvatar
                            delete theme._selectedPrize
                            delete theme._selectedSkinName
                            delete theme._selectedThemeName

                        res
                            tip: "#{name}"
                            title:"#{theme.skin_tip}"
                    else
                        res null
                    # 入室通知
                    delete user.ip
                    Server.game.game.inlog room,user
                    delete user.tpr
                    if room.blind
                        delete user.realid
                    if room.mode!="playing"
                        ss.publish.channel "room#{roomid}", "join", user
    # 部屋から出る
    unjoin: (roomid,quitThemeRoom)->
        unless req.session.userId
            res i18n.t "common:error.needLogin"
            return
        Server.game.rooms.oneRoomS roomid,(room)=>
            if !room || room.error?
                res i18n.t "error.noSuchRoom"
                return
            pl = room.players.filter((x)->x.realid==req.session.userId)[0]
            unless pl
                res i18n.t "error.notMember"
                return
            if pl.mode=="gm"
                res i18n.t "error.unjoin.noGMLeave"
                return
            unless room.mode=="waiting"
                res i18n.t "error.alreadyStarted"
                return
            if room.theme && !quitThemeRoom
                res confirm:"quitThemeRoom"
                return
            libready.unregister roomid, pl
            # consistencyのためにplayersをまるごとアップデートする
            room.players = room.players.filter (x)=> x.realid != req.session.userId
            # 帮手になっている人は解除
            for p, i in room.players
                if p.mode == "helper_#{pl.userid}"
                    ss.publish.channel "room#{roomid}", "mode", {userid: p.userid, mode: "player"}
                    p.mode = "player"
                    if p.start
                        ss.publish.channel "room#{roomid}", "ready", {userid: p.userid, start: false}
                        p.start = false
            update = {
                $set: {
                    players: room.players
                }
            }
            # record players who quit from theme room
            if room.quitfromtheme == undefined
                update.$set.quitfromtheme = {}
            else
                update.$set.quitfromtheme = room.quitfromtheme
            update.$set.quitfromtheme[req.session.userId] = Date.now()
            M.rooms.update {id:roomid},update,(err)=>
                if err?
                    res String err
                else
                    res null
                    # 退室通知
                    Server.game.game.outlog room,pl ? req.session.user
                    ss.publish.channel "room#{roomid}", "unjoin", pl?.userid


    ready:(roomid)->
        # 準備ができたか？
        console.log "ready:"+req.session.userId
        unless req.session.userId
            res i18n.t "common:error.needLogin"
            return
        Server.game.rooms.oneRoomS roomid,(room)=>
            if !room || room.error?
                res i18n.t "error.noSuchRoom"
                return
            unless req.session.userId in (room.players.map (x)->x.realid)
                res i18n.t "error.notMember"
                return
            unless room.mode=="waiting"
                res i18n.t "error.alreadyStarted"
                return
            room.players.forEach (x,i)=>
                if x.realid==req.session.userId
                    libready.setReady(ss, roomid, x, !x.start)
                        .then(-> res null)
                        .catch((err)-> res String err)

    # 部屋から追い出す
    kick:(roomid,id,ban)->
        unless req.session.userId
            res i18n.t "common:error.needLogin"
            return
        Server.game.rooms.oneRoomS roomid,(room)=>
            if !room || room.error?
                res i18n.t "error.noSuchRoom"
                return
            if room.owner.userid != req.session.userId
                res i18n.t "common:error.invalidInput"
                return
            unless room.mode=="waiting"
                res i18n.t "error.alreadyStarted"
                return
            pl=room.players.filter((x)->x.userid==id)[0]
            unless pl
                res i18n.t "common:error.invalidInput"
                return
            if pl.mode=="gm"
                res i18n.t "error.kick.noKickGM"
                return
            room.players = room.players.filter (x)=> x.realid != pl.realid
            for p, i in room.players
                if p.mode == "helper_#{pl.userid}"
                    ss.publish.channel "room#{roomid}", "mode", {userid: p.userid, mode: "player"}
                    p.mode = "player"
                    if p.start
                        ss.publish.channel "room#{roomid}", "ready", {userid: p.userid, start: false}
                        p.start = false

            libready.unregister roomid, pl
            update = {
                $set: {
                    players: room.players
                }
            }
            if ban
                # add to banned list
                update.$addToSet =
                    ban: id
            M.rooms.update {id:roomid}, update, (err)=>
                if err?
                    res String err
                else
                    res null
                    if pl?
                        Server.game.game.kicklog room, pl
                        ss.publish.channel "room#{roomid}", "unjoin",id
                        ss.publish.user pl.realid, "kicked",{id:roomid}
    # 帮手になる
    helper:(roomid,id)->
        unless req.session.userId
            res i18n.t "common:error.needLogin"
            return
        sethelper ss,roomid,req.session.userId,id,res
    # 全員ready解除する
    unreadyall:(roomid)->
        unless req.session.userId
            res i18n.t "common:error.needLogin"
            return
        Server.game.rooms.oneRoomS roomid,(room)=>
            if !room || room.error?
                res i18n.t "error.noSuchRoom"
                return
            if room.owner.userid != req.session.userId
                res i18n.t "common:error.invalidInput"
                console.log room.owner,req.session.userId
                return
            unless room.mode=="waiting"
                res i18n.t "error.alreadyStarted"
                return
            libready.unreadyAll(ss, roomid, room.players)
                .then(()-> res null)
                .catch((err)-> res String err)
    # 追い出しリストを取得
    getbanlist:(roomid)->
        unless req.session.userId
            res {error: i18n.t "common:error.needLogin"}
            return
        Server.game.rooms.oneRoomS roomid,(room)=>
            if !room || room.error?
                res {error: i18n.t "error.noSuchRoom"}
                return
            if room.owner.userid != req.session.userId
                res {error: i18n.t "common:error.invalidInput"}
                return
            res {result: room.ban ? []}
    # 追い出しリストを編集
    cancelban:(roomid, ids)->
        unless req.session.userId
            res i18n.t "common:error.needLogin"
            return
        unless Array.isArray ids
            res i18n.t "common:error.invalidInput"
            return
        Server.game.rooms.oneRoomS roomid, (room)->
            if !room || room.error?
                res i18n.t "error.noSuchRoom"
                return
            if room.owner.userid != req.session.userId
                res i18n.t "common:error.invalidInput"
                return
            M.rooms.update {
                id: roomid
            }, {
                $pullAll: {
                    ban: ids
                }
            }, (err)->
                if err?
                    res String err
                else
                    res null



    # 成功ならjoined 失敗ならエラーメッセージ
    # 部屋ルームに入る
    enter: (roomid,password)->
        #unless req.session.userId
        #   res {error:"请登录"}
        #   return
        Server.game.rooms.oneRoomS roomid,(room)=>
            if !room?
                res {error: i18n.t "error.noSuchRoom"}
                return
            if room.error?
                res {error:room.error}
                return
            # 古い部屋なら密码いらない
            od=Date.now()-Config.rooms.fresh*3600000
            if room.password? && room.mode!="end" && room.made>od && room.password!=password && password!=Config.admin.password
                res {require:"password"}
                return
            req.session.channel.reset()

            req.session.channel.subscribe "room#{roomid}"
            Server.game.game.playerchannel ss,roomid,req.session
            res {joined:room.players.some((x)=>x.realid==req.session.userId)}

    # 成功ならnull 失敗ならエラーメッセージ
    # 部屋ルームから出る
    exit: (roomid)->
        req.session.channel.reset()
        res null
    # 部屋を削除
    del: (roomid)->
        unless req.session.userId
            res i18n.t "common:error.needLogin"
            return
        Server.game.rooms.oneRoomS roomid,(room)=>
            if !room || room.error?
                res i18n.t "error.noSuchRoom"
                return
            if !room.old && room.owner.userid != req.session.userId
                res i18n.t "common:error.invalidInput"
                return
            unless room.mode=="waiting"
                res i18n.t "error.alreadyStarted"
                return
            for pl in room.players
                libready.unregister roomid, pl
            M.rooms.update {id:roomid},{$set: {mode:"end"}},(err)=>
                if err?
                    res String err
                else
                    res null
                    Server.game.game.deletedlog ss,room

    # 部屋探し
    find:(query,page)->
        unless query?
            res {error: i18n.t "common:error.invalidInput"}
            return
        res {error: i18n.t "error.find.disabled"}
        return
        q=
            finished:true
        if query.result_team
            q.winner=query.result_team  # 胜利阵营
        if query.min_number? && query.max_number
            q["$where"]="#{query.min_number}<=(l=this.players.length) && l<=#{query.max_number}"
        else if query.min_number?
            q["$where"]="#{query.min_number}<=this.players.length"
        else if query.max_number?
            q["$where"]="this.players.length<=#{query.max_number}"

        if query.min_day
            q.day ?= {}
            q.day["$gte"]=query.min_day
        if query.max_day
            q.day ?= {}
            q.day["$lte"]=query.max_day
        if query.rule
            q["rule.jobrule"]=query.rule
        # 日付新しい
        M.games.find(q).sort({_id:-1}).limit(page_number).skip(page_number*page).toArray (err,results)->
            if err?
                throw err
                return
            # gameを得たのでroomsに
            M.rooms.find({id:{$in: results.map((x)->x.id)}}).sort({_id:-1}).toArray (err,docs)->
                docs.forEach (x)->
                    if x.password?
                        x.needpassword=true
                        delete x.password
                    if x.blind
                        delete x.owner
                        x.players.forEach (p)->
                            unless p?
                                console.log "room fatal error ID:"+x.id
                                return
                            delete p.realid
                res docs
    suddenDeathPunish:(roomid,banIDs)->
        # banIDs = ["someID","someID"]
        unless banIDs.length
            res null
            return
        unless req.session.userId
            res {error: i18n.t "common:error.needLogin",require:"login"}    # ログインが必要
            return
        err = Server.game.game.suddenDeathPunish ss, roomid, req.session.userId, banIDs
        if err?
            res {error: err}
        else
            res null

#res: (err)->
setRoom=(roomid,room)->
    M.rooms.update {id:roomid},room,res
