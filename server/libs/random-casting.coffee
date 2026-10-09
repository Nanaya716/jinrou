Shared = require '../../client/code/shared/game.coffee'
yaminabe = require './yaminabe.coffee'

# 推荐配置只使用可分配的职业及隐藏职业，不把附加状态当作职业抽取。
# 与游戏共用高安全性生成算法；默认公开名单、非化学、非两阵营、非败北村。
roleNames = Shared.jobs.concat Shared.hiddenJobs
jobs = {}
for job in roleNames
    jobs[job] = true

# 指定人数沿用实际游戏开局下限与本站房间上限；随机推荐仍只抽 12–30 人。
exports.minPlayers = 6
exports.maxPlayers = 40

exports.generate = (number)->
    # 未指定人数时先按区间抽签，再在区间内等概率选人数。
    # 12–18 人合计 70%，19–30 人合计 30%；指定人数不走这次抽签。
    unless number?
        number = if Math.random() < 0.7
            12 + Math.floor Math.random() * 7
        else
            19 + Math.floor Math.random() * 12
    unless Number.isInteger(number) && exports.minPlayers <= number <= exports.maxPlayers
        throw new Error "人数必须是 #{exports.minPlayers}–#{exports.maxPlayers} 之间的整数。"

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
    # 预留一个村人阵营名额，在高安全性原本的占卜选择步骤中三选一。
    # 不提前塞职业，避免 SP/无谋与原有 75% 普通占卜师步骤叠加。
    diviners = ['Diviner', 'SuperDiviner', 'MumouDiviner']

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
        joblist.category_Human = 1
        result = yaminabe.generate {
            joblist, query, jobs
            playersnumber: number
            frees: number - humanCount - 1
            fixedJobs: ['Human']
            guaranteeDiviner: true
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
    # 按村人阵营、人狼系、狂人系、妖狐系等现有分类排列，
    # 未分类职业补在末尾，避免隐藏职业遗漏或跨分类重复显示。
    orderedJobs = []
    for category in Shared.categoryList
        orderedJobs.push category.roles...
    orderedJobs = Array.from new Set orderedJobs.concat roleNames
    parts = []
    for job in orderedJobs when casting.joblist[job] > 0
        parts.push "#{i18n.t "jobname.#{job}"}: #{casting.joblist[job]}"
    "#{casting.number}人 - 使绊子 / #{parts.join ' '}"
