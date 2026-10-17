# Server-side Code
crypto=require('crypto')
child_process=require('child_process')
settings=Config.mongo
ObjectID=require('mongodb').ObjectID

libblacklist = require '../libs/blacklist.coffee'
libi18n      = require '../libs/i18n.coffee'
libready     = require '../libs/ready.coffee'
libgame      = require './game/game.coffee'

i18n = libi18n.getWithDefaultNS 'admin'

# twitter系
oauth=require './../oauth.coffee'
exports.actions =(req,res,ss)->
    req.use 'session'
    # 现在のセッションを管理者として承認する
    register:(query)->
        flag=false
        req.session.administer=false
        req.session.maintenance=false
        if query.password==Config.admin.password
            req.session.administer=true
            flag=true
        if query.password==Config.maintenance.password
            req.session.maintenance=true
            flag=true

        unless flag
            res i18n.t "error.wrongPassword"
        else
            req.session.save ->res null

    # ------------- blacklist関係
    getBlacklist:(query)->
        # blacklist一覧を得る
        unless req.session.administer
            res {error: i18n.t "error.notAdmin"}
            return
        d = new Date()
        M.blacklist.find({$or:[{expires:{$gt:d}},{expires:{$exists:false}}]}).limit(100).skip(100*(query.page ? 0)).toArray (err,docs)->
            M.blacklist.count (err, count)->
                res {docs:docs,page:query.page ? 0,total:Math.ceil(docs.length / 100)}
    addBlacklist:(query)->
        # blacklistに新しいのを追加
        unless req.session.administer
            res {error: i18n.t "error.notAdmin"}
            return
        libblacklist.addBlacklist query, res
        # 即時反映（居れば）
        ss.publish.user query.userid, "forcereload"
    removeBlacklist:(query)->
        # blacklistを1つ解除
        unless req.session.administer
            res {error: i18n.t "error.notAdmin"}
            return
        libblacklist.forgive query.id, (err)->
            res err
    restoreBlacklist:(query)->
        # 解除されたblacklistをもどす
        unless req.session.administer
            res {error: i18n.t "error.notAdmin"}
            return
        libblacklist.restore query.id, (err)->
            res err
    # -------------- grandalert関係
    spreadGrandalert:(query)->
        unless req.session.administer
            res {error: i18n.t "error.notAdmin"}
            return
        if query.system
            message=
                title:query.title
                message:query.message
            ss.publish.all 'grandalert',message
        if query.twitter
            # twitterへ配信
            oauth.tweet "#{query.message} ##{Config.name}",Config.admin.password
        res null
    # -------------- dataexport関係
    dataExport:(query)->
        unless query?
            res {error: i18n.t "common:error.invalidInput"}
            return
        unless Config.admin.securityHole
            res {error: i18n.t "error.unavailable"}
            return

        sha256=crypto.createHash "sha256"
        sha256.update query.pass
        phrase=sha256.digest 'hex'
        unless phrase=='d77696ef7b89048f9e68d671da5fc825f9f2e9791fcef52c4c482d608beb49e2'
            res {error: i18n.t "error.wrongPassword"}
            return
        child = child_process.exec "mongodump -d #{settings.database} -u #{settings.user} -p #{settings.pass} -o ./public/dump", (error,stdout,stderr)->
            if error?
                res {error:stderr}
                return
            # dumpに成功した
            child_process.exec "zip -r ./public/dump/#{settings.database}.zip ./public/dump/#{settings.database}/",(error,stdout,stderr)->
                if error?
                    res {error:stdout || stderr}
                    return
                console.log stdout
                res {file:"/dump/#{settings.database}.zip"}

    # ------------- process関係
    doCommand:(query)->
        # 僕だけだよ！ あの文字列を送ろう
        unless query?
            res {error: i18n.t "common:error.invalidInput"}
            return
        unless Config.admin.securityHole
            res {error: i18n.t "error.unavailable"}
            return
        if pro?
            # まだ起動している
            pro.kill()

        sha256=crypto.createHash "sha256"
        sha256.update query.pass
        phrase=sha256.digest 'hex'
        unless phrase=='d77696ef7b89048f9e68d671da5fc825f9f2e9791fcef52c4c482d608beb49e2'
            res {error: i18n.t "error.wrongPassword"}
            return
        if query.command=="show_dbinfo"
            res result:"#{settings.database}:#{settings.user}:#{settings.pass}"
            return
        pro = child_process.exec query.command, (error,stdout,stderr)->
            pro=null
            if error?
                res {error:stderr || stdout}
                return
            res {result:stdout}
    startProcess:(cmd)->
        if pro?
            res {error: i18n.t "error.unavailable"}
            return
        unless typeof cmd=="string"
            res {error: i18n.t "common:error.invalidInput"}
            return
        args=cmd.split " "
        comm=args.shift()
        pro= child_process.spawn comm,args
    #   刷新房间创建时间
    refreshRoomMade: (query)->
        unless req.session.maintenance
            res {error: i18n.t "error.notAdmin"}
            return
        roomid=parseInt query?.roomid, 10
        unless roomid > 0
            res {error: i18n.t "common:error.invalidInput"}
            return
        made=Date.now()
        M.rooms.findOne {id:roomid}, (err, room)->
            if err?
                res {error: err.message ? err}
                return
            unless room?
                res {error: "房间不存在。"}
                return
            M.rooms.update {id:roomid}, {$set:{made:made}}, {safe:true}, (err)->
                if err?
                    res {error: err.message ? err}
                    return
                res {result: "已将 #{roomid} 号房间创建时间刷新为 #{new Date(made).toLocaleString()}。"}
    #   废弃等待中的房间
    abandonRoom: (query)->
        unless req.session.maintenance
            res {error: i18n.t "error.notAdmin"}
            return
        roomid=parseInt query?.roomid, 10
        unless roomid > 0
            res {error: i18n.t "common:error.invalidInput"}
            return
        M.rooms.findOne {id:roomid}, (err, room)->
            if err?
                res {error: err.message ? err}
                return
            unless room?
                res {error: "房间不存在。"}
                return
            unless room.mode == "waiting"
                res {error: "只能废弃等待中的房间。"}
                return
            M.rooms.updateOne {id:roomid, mode:"waiting"}, {$set:{mode:"end"}}, {w:1}, (err, result)->
                if err?
                    res {error: err.message ? err}
                    return
                unless result?.matchedCount
                    res {error: "房间状态已变化，无法废弃。"}
                    return
                for pl in room.players
                    libready.unregister roomid, pl
                libgame.deletedlog ss,room
                res {result: "已废弃 #{roomid} 号房间。"}
    #   将进行中的房间结算为平局
    drawRoom: (query)->
        unless req.session.maintenance
            res {error: i18n.t "error.notAdmin"}
            return
        roomid=parseInt query?.roomid, 10
        unless roomid > 0
            res {error: i18n.t "common:error.invalidInput"}
            return
        M.rooms.findOne {id:roomid}, (err, room)->
            if err?
                res {error: err.message ? err}
                return
            unless room?
                res {error: "房间不存在。"}
                return
            unless room.mode == "playing"
                res {error: "只能将进行中的房间结算为平局。"}
                return
            libgame.forceDraw roomid, ss, (err)->
                if err?
                    res {error: err.message ? err}
                    return
                res {result: "已将 #{roomid} 号房间结算为平局。"}
    #   关闭陈旧房间
    # 关闭陈旧房间
    shutdownExpireRooms: ->
        unless req.session.maintenance
            res {error: i18n.t "error.notAdmin"}
            return
        notFresh = Date.now() - Config.rooms.fresh * 60 * 60 * 1000
        # 查询满足条件的过期房间
        M.rooms.find({"mode": {$ne: "end"}, "made": {$lt: notFresh}}).toArray (err, docs) ->
            if err?
                res {error: err}
                return
            # 遍历过期房间并更新状态
            ids = docs.map (item)-> return item.id
            # 关闭房间
            M.rooms.update({id: {$in: ids}}, {$set: {"mode": "end"}}, {multi: true}, (err) ->
                if err?
                    res {error: err}
                    return
            )
            # 更新游戏状态为已结束
            M.games.update({id: {$in: ids}}, {$set: {"finished": true}}, {multi: true}, (err) ->
                if err?
                    res {error: err}
                    return
            )
            res {result: "关闭了 #{docs.length} 个陈旧房间"}
    #-- 更新
    update:->
        unless req.session.maintenance
            res {error: i18n.t "error.notAdmin"}
            return
        script=Config.maintenance.script ? []
        result=""
        error=false
        one=(index)->
            unless script[index]?
                # もうない
                res {result:result}
                return
            result+="> #{script[index]}\n"
            child = child_process.exec script[index], (error,stdout,stderr)->
                console.log stdout
                if error?
                    result+=stderr+"\n"
                    res {error:result}
                    return
                # 成功した
                result+=stdout+"\n"
                one index+1
        one 0
    end:->
        unless req.session.maintenance
            res {error: i18n.t "error.notAdmin"}
            return
        process.exit()
        res {}

    # ------------- news関係
    # news一览を得る
    getNews:(query)->
        unless req.session.maintenance
            res {error: i18n.t "error.notAdmin"}
            return
        M.news.find().sort({time:-1}).limit(query.num).toArray (err,docs)->
            res {docs:docs}
    addNews:(query)->
        unless req.session.maintenance
            res {error: i18n.t "error.notAdmin"}
            return
        unless query?.message
            res {error: i18n.t "common:error.invalidInput"}
            return
        addquery=
            time:new Date()
            message:query.message
        M.news.findOne {message:addquery.message},(err,doc)->
            unless doc?
                M.news.insert addquery,{safe:true},(err,doc)->
                    res null
            else
                res null
    updateNews:(query)->
        unless req.session.maintenance
            res {error: i18n.t "error.notAdmin"}
            return
        unless query?.id && query?.message
            res {error: i18n.t "common:error.invalidInput"}
            return
        try
            id=new ObjectID query.id
        catch err
            res {error: i18n.t "common:error.invalidInput"}
            return
        M.news.findOne {_id:id}, (err, doc)->
            if err?
                res {error: err.message ? err}
                return
            unless doc?
                res {error: "通知不存在。"}
                return
            M.news.update {_id:id}, {$set:{message:query.message}}, {safe:true}, (err)->
                if err?
                    res {error: err.message ? err}
                    return
                res null
    deleteNews:(query)->
        unless req.session.maintenance
            res {error: i18n.t "error.notAdmin"}
            return
        unless query?.id
            res {error: i18n.t "common:error.invalidInput"}
            return
        try
            id=new ObjectID query.id
        catch err
            res {error: i18n.t "common:error.invalidInput"}
            return
        M.news.findOne {_id:id}, (err, doc)->
            if err?
                res {error: err.message ? err}
                return
            unless doc?
                res {error: "通知不存在。"}
                return
            M.news.remove {_id:id}, {safe:true}, (err)->
                if err?
                    res {error: err.message ? err}
                    return
                res null

pro=null    # 现在のプロセス
