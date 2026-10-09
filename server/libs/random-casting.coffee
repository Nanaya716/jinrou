Shared = require '../../client/code/shared/game.coffee'
yaminabe = require './yaminabe.coffee'

# 推荐配置只使用可分配的职业及隐藏职业，不把附加状态当作职业抽取。
# 与游戏共用高安全性生成算法；默认公开名单、非化学、非两阵营、非败北村。
roleNames = Shared.jobs.concat Shared.hiddenJobs
jobs = {}
for job in roleNames
    jobs[job] = true

exports.generate = (number)->
    number ?= 12 + Math.floor Math.random() * 19
    unless Number.isInteger(number) && 12 <= number <= 30
        throw new Error '人数必须是 12–30 之间的整数。'

    query =
        jobrule: '特殊规则.黑暗火锅'
        yaminabe_safety: 'high'
        yaminabe_hidejobs: ''
        chemical: ''
        ushi: ''
        losemode: ''

    # 人数离散化后仍须严格落在 10%–40%，只统计真实 Human，
    # 不把 Oracle/Fate 等显示为村人的职业计入；重试时保持同一目标人数。
    minHumans = Math.ceil number * 0.1
    maxHumans = Math.floor number * 0.4
    humanCount = minHumans + Math.floor Math.random() * (maxHumans - minHumans + 1)
    # 至少一位占卜师/SP占卜师/无谋占卜师，三种保底职业等概率选择。
    # 预留名额后仍允许原算法额外抽取占卜职业，不限制其总数。
    diviners = ['Diviner', 'SuperDiviner', 'MumouDiviner']
    guaranteedDiviner = diviners[Math.floor Math.random() * diviners.length]

    # 原算法有尝试次数上限，极端情况下可能留下未分配名额。
    # 仅返回完整的职业配置；有限重试后报错，避免把残缺名单发到群里。
    for attempt in [0...10]
        joblist = {}
        for job in roleNames
            joblist[job] = 0
        for category of Shared.categories
            joblist["category_#{category}"] = 0
        # 先固定新规则，再让高安全性算法填充剩余位置；不在生成后替换职业。
        joblist.Human = humanCount
        joblist[guaranteedDiviner] = 1
        result = yaminabe.generate {
            joblist, query, jobs
            playersnumber: number
            frees: number - humanCount - 1
            fixedJobs: ['Human']
            jobStrength: {}
            humanDisplayJobs: ['Oracle', 'Fate', 'Sleepwalker', 'Dreamer']
        }
        throw new Error result.error if result.error?
        counts = result.joblist
        total = roleNames.reduce ((sum, job)-> sum + counts[job]), 0
        unresolved = Object.keys(counts).some (key)->
            /^(category_|team_)/.test(key) && counts[key] > 0
        hasDiviner = diviners.some (job)-> counts[job] > 0
        if total == number && !unresolved && counts.Human == humanCount && hasDiviner
            return {number, joblist: counts}
    throw new Error '未能生成完整职业配置，请稍后重试。'

exports.buildMessage = (number)->
    casting = exports.generate number
    # 延迟取得翻译实例，与站点使用同一份中文职业名称，保留思念系真实职业名。
    i18n = require('./i18n.coffee').getWithDefaultNS 'roles'
    lines = []
    for job in roleNames when casting.joblist[job] > 0
        lines.push "#{i18n.t "jobname.#{job}"} × #{casting.joblist[job]}"
    "【随机职业配置】#{casting.number}人\n黑暗火锅 · 高安全性\n#{lines.join '\n'}"
