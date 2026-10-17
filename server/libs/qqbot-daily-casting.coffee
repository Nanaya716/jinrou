cron = require 'cron'
randomCasting = require './random-casting.coffee'

job = null

exports.start = (config, getGroupOpenIDs, send)->
    return if job? || config.dailyCasting == false
    # 固定北京时间，不随服务器或容器的本地时区改变；不在启动时补发。
    job = new cron.CronJob '0 0 10 * * *', (->
        exports.run(getGroupOpenIDs(), send).catch (err)->
            console.error '[QQBot] Failed to run daily casting.'
            console.error err.stack || err
    ), null, true, 'Asia/Shanghai'

exports.run = (groupOpenIDs, send, now = new Date)->
    # 日期键也按北京时间计算，MongoDB 的 _id 唯一索引用于跨实例防重。
    date = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice 0, 10
    groups = Array.from new Set groupOpenIDs
    return Promise.resolve [] unless groups.length
    Promise.resolve().then ->
        collection = DB.collection 'qqbot_daily_castings'
        # 同一次推送的所有目标群收到同一份名单。
        content = randomCasting.buildMessage()
        results = []
        groups.reduce ((pending, groupOpenID)->
            pending.then ->
                id = "#{date}:#{groupOpenID}"
                # 先占用再发消息：多实例、重复触发不会重复发送。
                # 发送失败或进程中途退出也不自动重试，避免结果不明时重复骚扰群。
                claim = new Promise (resolve, reject)->
                    collection.insertOne {
                        _id: id
                        date: date
                        groupOpenID: groupOpenID
                        status: 'sending'
                        createdAt: now
                    }, {w: 1}, (err)->
                        if err?.code == 11000
                            resolve false
                        else if err?
                            reject err
                        else
                            resolve true
                claim.then (claimed)->
                    return unless claimed
                    sending = Promise.resolve().then -> send groupOpenID, content
                    sending.then (-> saveStatus collection, id, 'sent'), (err)->
                        console.error '[QQBot] Failed to send daily casting to group.', groupOpenID
                        console.error err.stack || err
                        saveStatus collection, id, 'failed'
                .catch (err)->
                    # 单群失败不影响其余群，数据库异常时不冒险发送。
                    console.error '[QQBot] Failed to record daily casting for group.', groupOpenID
                    console.error err.stack || err
                .then (result)-> results.push result
        ), Promise.resolve()
        .then -> results

saveStatus = (collection, id, status)->
    new Promise (resolve, reject)->
        collection.updateOne {_id: id}, {
            $set: {status, updatedAt: new Date}
        }, {w: 1}, (err)->
            if err? then reject err else resolve status
