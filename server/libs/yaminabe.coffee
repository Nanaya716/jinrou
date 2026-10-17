Shared =
    game: require '../../client/code/shared/game.coffee'
libgame = require './game.coffee'

# 保留开局原有的浅拷贝方式，生成过程不会改动职业注册表。
copyObject = (obj)->
    result = Object.create Object.getPrototypeOf obj
    for key in Object.keys obj
        result[key] = obj[key]
    result

# 从开局流程抽出的原算法。调用方提供职业池、初始人数和规则，
# 不创建房间、不操作玩家、不读写数据库，也不发送游戏日志。
# 高安全性仍使用 high；原有其他安全等级与手调火锅也走同一流程。
exports.generate = ({joblist, frees, playersnumber, query, jobs, jobStrength, humanDisplayJobs, fixedJobs, guaranteeDiviner, minHumanTeam, excludedJobs})->
    # 独立推荐可预留固定职业；调用方先填 joblist 并从 frees 扣除名额。
    # 固定职业不再参与抽取，但不当作禁用职业，避免连带禁用思念系等角色。
    # 实际开局不传 fixedJobs，仍沿用原候选池与随机流程。
    fixedJobs ?= []
    # 内部用にチームによる役職指定
    for team of Shared.game.teams
        joblist["team_#{team}"] = 0
    # カテゴリ内の人数の合計がわかる関数
    countCategory=(categoryname)->
        Shared.game.categories[categoryname].reduce(((prev,curr)->prev+(joblist[curr] ? 0)),0)+joblist["category_#{categoryname}"]
    countTeam=(teamname)->
        Shared.game.categories[teamname].reduce(((prev,curr)->prev+(joblist[curr] ? 0)),0)+joblist["team_#{teamname}"]

    # 黑暗火锅のときはランダムに決める
    plsh=Math.floor playersnumber/ 2   # 過半数

    if query.jobrule in ["特殊规则.手调黑暗火锅", "特殊规则.easyYaminabe"]
        # 配役が既に部分的に決定している場合は残りだけ担当する
        for job in Shared.game.jobs
            frees -= joblist[job]
        for type of Shared.game.categories
            frees -= joblist["category_#{type}"]

    safety={
        jingais:false   # 人外の数を調整
        ppcheck:false   # ほぼteamsの処理をするだけ
        teams:false     # 陣営の数を調整
        jobs:false      # 職どうしの数を調整
        strength:false  # 職の強さも考慮
        reverse:false   # 職の強さが逆
    }
    yaminabe_safety = query.yaminabe_safety
    if query.jobrule == "特殊规则.easyYaminabe"
        # かんたん黑暗火锅はセーフティ高に固定
        yaminabe_safety = "high"
    switch yaminabe_safety
        when "low"
            # 低い
            safety.jingais=true
        when "lowlow"
            safety.jingais=true
            safety.ppcheck=true
        when "middle"
            safety.jingais=true
            safety.teams=true
        when "high"
            safety.jingais=true
            safety.teams=true
            safety.jobs=true
        when "super"
            safety.jingais=true
            safety.teams=true
            safety.jobs=true
            safety.strength=true
        when "supersuper"
            safety.jobs=true
            safety.strength=true
        when "reverse"
            safety.jingais=true
            safety.strength=true
            safety.reverse=true


    # 黑暗火锅のときは入れないのがある
    exceptions=[]
    # 闇鍋で出してはいけない役職
    special_exceptions=[
        "MinionSelector",
        "Thief",
        "GameMaster",
        "Helper",
        "QuantumPlayer",
        "Waiting",
        "Watching",
        "GotChocolate",
        "HooliganAttacker",
        "HooliganGuard",
        "Listener",
        "SpaceWerewolfCrew",
        "SpaceWerewolfImposter",
        "SpaceWerewolfObserver",
        "SpaceWerewolfGuard",
        "SpaceWerewolfSabotage"
    ]
    exceptions.push special_exceptions...
    # ユーザーが指定した入れないの
    # 独立推荐可限制第三方种类；同时约束预分配和分类抽取。
    # 未传此选项的游戏开局不受影响。
    excluded_exceptions=(excludedJobs ? []).slice()
    exceptions.push excluded_exceptions...
    special_exceptions.push excluded_exceptions...
    # カテゴリをまとめてexceptionに追加する関数
    addCategoryToExceptions = (category)->
        for job in Shared.game.categories[category]
            exceptions.push job
    addTeamToExceptions = (team)->
        for job in Shared.game.teams[team]
            exceptions.push job

    # チェックボックスが外れてるやつは登場しない
    if query.jobrule=="特殊规则.手调黑暗火锅"
        for job in libgame.categorySortedJobs()
            if query["job_use_#{job}"] != "on"
                # これは出してはいけない指定になっている
                exceptions.push job
                excluded_exceptions.push job

    # 2陣営戦
    if query.ushi=="on"
        addTeamToExceptions "Fox"        #第三陣営（妖狐・背徳）除外
        addTeamToExceptions "Others"     #陣営に属さない役職の除外
        addCategoryToExceptions "Others" #第四陣営以降の役職の除外
        addCategoryToExceptions "None"   #ニートの除外

    # 村人だと思い込むシリーズは村人除外で出現しない
    if excluded_exceptions.some((x)->x=="Human")
        exceptions.push "Hanami", "Princess", humanDisplayJobs...
        special_exceptions.push "Hanami", "Princess", humanDisplayJobs...
    # メアリーの特殊処理（セーフティ高じゃないとでない）
    if query.yaminabe_hidejobs=="" || (!safety.jobs && query.yaminabe_safety!="none")
        exceptions.push "BloodyMary"
        special_exceptions.push "BloodyMary"
    # スパイ2（人気がないので出ない）
    if safety.jingais || safety.jobs
        exceptions.push "Spy2"
        special_exceptions.push "Spy2"
    # 悪霊憑き（人気がないので出ない）
    if safety.jingais || safety.jobs
        exceptions.push "SpiritPossessed"
        special_exceptions.push "SpiritPossessed"
    # 狂人狼（人気がないので出ない）
    if safety.jingais || safety.jobs
        exceptions.push "MadWolf"
        special_exceptions.push "MadWolf"
    # 公主は女王観戦者の安全性チェックを通した後にだけ出す
    if safety.jobs
        exceptions.push "Princess"
        special_exceptions.push "Princess"
    # 闇道化
    if safety.jingais || safety.jobs
        exceptions.push "DarkClown"
        special_exceptions.push "DarkClown"
    # 絶対狼
    if Math.random()<0.4
        exceptions.push "AbsoluteWolf"
        special_exceptions.push "AbsoluteWolf"
    # 村人表記シリーズ
    if Math.random()<0.3
        exceptions.push "Oracle"
        special_exceptions.push "Oracle"
    if Math.random()<0.3
        exceptions.push "Fate"
        special_exceptions.push "Fate"
    if Math.random()<0.3
        exceptions.push "Sleepwalker"
        special_exceptions.push "Sleepwalker"
    if Math.random()<0.3
        exceptions.push "Dreamer"
        special_exceptions.push "Dreamer"
    if Math.random()<0.3
        exceptions.push "Hanami"
        special_exceptions.push "Hanami"
    # ニートは隠し役職（出現率低）
    if query.losemode == "on" || Math.random()<0.4
        exceptions.push "Neet"
        special_exceptions.push "Neet"

    # 一部闇鍋で固定されているやつが全て除外されていないかチェック
    for type, categoryjobs of Shared.game.categories
        if joblist["category_#{type}"] > 0
            jobset = new Set categoryjobs
            for job in excluded_exceptions
                jobset.delete job
            if jobset.size == 0
                # candidates are empty!
                return error: "error.gamestart.categoryAllExcluded", category: type
    # 人狼系は全除外してはいけない
    for cat in ["Werewolf"]
        jobset = new Set Shared.game.categories[cat]
        for job in excluded_exceptions
            jobset.delete job
        if jobset.size == 0
            return error: "error.gamestart.implicitCategoryAllExcluded", category: cat



    #人外の数
    if safety.jingais
        # いい感じに決めてあげる
        wolf_number=1
        fox_number=0
        vampire_number=0
        devil_number=0
        lorelei_number=0
        if playersnumber>=9
            wolf_number++
            if playersnumber>=12
                if Math.random()<0.6
                    fox_number++
                else if Math.random()<0.7
                    devil_number++
                if playersnumber>=14
                    wolf_number++
                    if playersnumber>=16
                        if Math.random()<0.5
                            fox_number++
                        else if Math.random()<0.3
                            vampire_number++
                        else
                            devil_number++
                        if playersnumber>=18
                            wolf_number++
                            if playersnumber>=22
                                if Math.random()<0.2
                                    fox_number++
                                else if Math.random()<0.6
                                    vampire_number++
                                else if Math.random()<0.9
                                    devil_number++
                            if playersnumber>=24
                                wolf_number++
                                if playersnumber>=30
                                    wolf_number++
        # ランダム調整
        if wolf_number>1 && Math.random()<0.1
            wolf_number--
        else if playersnumber>=12 && Math.random()<0.2
            wolf_number++
        if fox_number>1 && Math.random()<0.15
            fox_number--
        else if playersnumber>=11 && Math.random()<0.25
            fox_number++
        else if playersnumber>=8 && Math.random()<0.1
            fox_number++
        if playersnumber>=11 && Math.random()<0.2
            vampire_number++
        if playersnumber>=11 && Math.random()<0.2
            devil_number++
        if playersnumber>=13 && Math.random()<0.1
            lorelei_number++

        if query.jobrule == "特殊规则.手调黑暗火锅"
            # 手调黑暗火锅の指定との兼ね合いを調整する
            if countCategory("Werewolf") > wolf_number
                # 多いのでそちらに合わせる
                wolf_number = countCategory("Werewolf")
            if countCategory("Fox") + joblist.Blasphemy > fox_number
                fox_number = countCategory("Fox") + joblist.Blasphemy
        # セットする
        diff = wolf_number - countCategory("Werewolf")
        if diff > 0
            joblist.category_Werewolf += diff
            frees -= diff

        # 除外役職を入れないように気をつける
        nonavs = {}
        for job in exceptions
            nonavs[job] = true

        # 狐を振分け
        diff = Math.max 0, (fox_number - countCategory("Fox") - joblist.Blasphemy)

        for i in [0...diff]
            if frees <= 0
                break
            r = Math.random()
            if r<0.21 && !nonavs.Fox
                joblist.Fox++
                frees--
            else if r<0.32 && !nonavs.NineTailedFox
                joblist.NineTailedFox++
                frees--
            else if r < 0.47 && !nonavs.TinyFox
                joblist.TinyFox++
                frees--
            else if r<0.59 && !nonavs.XianFox
                joblist.XianFox++
                frees--
            else if r<0.70 && !nonavs.VariationFox
                joblist.VariationFox++
                frees--
            else if r<0.80 && !nonavs.Actress
                joblist.Actress++
                frees--
            else if r<0.9 && !nonavs.Trickster
                joblist.Trickster++
                frees--
            else if r<0.95 && !nonavs.NightRabbit
                joblist.NightRabbit++
                frees--
            else if !nonavs.Blasphemy
                joblist.Blasphemy++
                frees--

        diff = Math.max 0, (vampire_number - joblist.Vampire - joblist.Dracula)
        for i in [0...diff]
            if frees <= 0
                break
            r = Math.random()
            if r < 0.7 && !nonavs.Vampire
                joblist.Vampire++
                frees--
            else if !nonavs.Dracula
                joblist.Dracula++
                frees--

        diff = Math.max 0, (devil_number - joblist.Devil)
        if !nonavs.Devil && diff > 0
            if diff <= frees
                joblist.Devil += diff
                frees -= diff
            else
                joblist.Devil += frees
                frees = 0

        diff = Math.max 0, (lorelei_number - joblist.Lorelei)
        if !nonavs.Lorelei && diff > 0
            if diff <= frees
                joblist.Lorelei += diff
                frees -= diff
            else
                joblist.Lorelei += frees
                frees = 0
        # 人外は選んだのでもう選ばれなくする
        exceptions=exceptions.concat Shared.game.nonhumans
        exceptions.push "Blasphemy"
    else
        # 人狼0は避ける最低限の調整
        if countCategory("Werewolf") == 0
            joblist.category_Werewolf=1
            frees--


    if safety.jingais || safety.jobs
        # 狐が誰も居ないときは背徳は出ない
        if Shared.game.categories.Fox.every((j)-> joblist[j]==0)
            exceptions.push "Immoral"
            exceptions.push "Perfidious"
            exceptions.push "Heretic"
        # 吸血鬼の眷属も
        if joblist.Vampire == 0 && joblist.Dracula == 0
            exceptions.push "VampireClan"
            special_exceptions.push "VampireClan"
        # 花見客は狼1では出ない
        if countCategory("Werewolf") < 2
            exceptions.push "Hanami"
            special_exceptions.push "Hanami"


    nonavs = {}
    for job in exceptions
        nonavs[job] = true
    # Choose one job from given list of jobs,
    # following given probabilities for each job.
    selectJob = (candidates, probabilities)->
        p = Math.random()
        current = 0
        for i in [0 ... candidates.length]
            job = candidates[i]
            prob = probabilities[i]
            if current <= p < current + prob
                # random p selects this job.
                if !nonavs[job]
                    # this job is not excluded.
                    return job
                current += prob
        # none was selected.
        return null


    if safety.teams || safety.ppcheck
        # 陣営調整もする
        # 人狼陣営
        if frees>0
            # 望ましい人狼陣営の人数は25〜350%くらい
            wolfteam_n = Math.round (playersnumber*(0.25 + Math.random()*0.1))
            # ただし半数を超えない
            plsh = Math.ceil(playersnumber/ 2)
            if wolfteam_n >= plsh
                wolfteam_n = plsh-1
            # 人狼系を数える
            wolf_number = countCategory "Werewolf"
            # 残りは狂人系
            if wolf_number <= wolfteam_n
                mad_number = Math.min(frees, wolfteam_n - wolf_number)
                diff = mad_number - countCategory("Madman")
                if diff > 0
                    joblist.category_Madman += diff
                frees -= diff
            # 狂人の処理終了
            addCategoryToExceptions "Madman"
        # 村人陣営
        if frees>0
            # 50%〜60%くらい
            humanteam_n =
                if query.chemical == "on"
                    # ケミカルの場合は多い
                    Math.round (playersnumber*(1.28 + Math.random()*0.12))
                else
                    Math.round (playersnumber*(0.48 + Math.random()*0.12))
            # count current number of Human team.
            # we rely on the fact that Human category is a subset of Human team.
            currentHuman = countTeam("Human") + joblist["category_Human"]
            # 独立推荐可要求村人阵营占严格多数；普通开局保留原计算方式。
            diff = if minHumanTeam?
                Math.min frees, Math.max(0, Math.max(humanteam_n, minHumanTeam) - currentHuman)
            else
                Math.min(frees, humanteam_n) - currentHuman
            if diff > 0
                joblist.team_Human += diff
                frees -= diff

            if query.ushi!="on"
                addTeamToExceptions "Human"
        # ヴァンパイア陣営
        if frees > 0 && (joblist.Vampire > 0 || joblist.Dracula > 0)
            if joblist.Vampire + joblist.Dracula == 1
                if playersnumber >= 15
                    if Math.random() < 0.25 && !nonavs.VampireClan
                        joblist.VampireClan++
                        frees--
                    if playersnumber <= 17
                        exceptions.push "VampireClan"
                else
                    if Math.random() < 0.05 && !nonavs.VampireClan
                        joblist.VampireClan++
                        frees--
            else if playersnumber <= 17
                exceptions.push "VampireClan"
        else
            exceptions.push "VampireClan"

        # 妖狐陣営
        if frees>0 && (joblist.Fox>0 || joblist.NineTailedFox > 0 || joblist.TinyFox > 0 || joblist.SuperFox > 0 || joblist.XianFox > 0 || joblist.NightRabbit > 0 || joblist.Trickster > 0 || joblist.VariationFox > 0)
            if joblist.Fox + joblist.NineTailedFox + joblist.TinyFox + joblist.SuperFox + joblist.XianFox + joblist.NightRabbit + joblist.Trickster + joblist.VariationFox == 1
                if playersnumber>=14
                    # 1人くらいは…
                    if Math.random()<0.25 && !nonavs.Immoral
                        joblist.Immoral++
                        frees--
                    if playersnumber <= 17
                        exceptions.push "Immoral"
                        exceptions.push "Heretic"
                        exceptions.push "Perfidious"
                else
                    # サプライズ的に…
                    if Math.random()<0.06 && !nonavs.Immoral
                        joblist.Immoral++
                        frees--
                    exceptions.push "Immoral"
                    exceptions.push "Heretic"
                    exceptions.push "Perfidious"
            else if playersnumber <= 17
                exceptions.push "Immoral"
                exceptions.push "Heretic"
                exceptions.push "Perfidious"
        else
            exceptions.push "Immoral"
            exceptions.push "Heretic"
            exceptions.push "Perfidious"
        # 恋人陣営
        if frees>0
            if 17>=playersnumber>=12
                if Math.random()<0.08 && !nonavs.Cupid
                    joblist.Cupid++
                    frees--
                else if Math.random()<0.03 && !nonavs.Lover
                    joblist.Lover++
                    frees--
                else if Math.random()<0.05 && !nonavs.SnowLover
                    joblist.SnowLover++
                    frees--
                else if Math.random()<0.04 && !nonavs.BadLady
                    joblist.BadLady++
                    frees--
                else if Math.random()<0.06 && !nonavs.LunaticLover
                    joblist.LunaticLover++
                    frees--
            else if 12>=playersnumber>=8
                if Math.random()<0.045 && !nonavs.Lover
                    joblist.Lover++
                    frees--
                else if Math.random()<0.025 && !nonavs.SnowLover
                    joblist.SnowLover++
                    frees--
                else if Math.random()<0.01 && !nonavs.Cupid
                    joblist.Cupid++
                    frees--
                else if Math.random()<0.03 && !nonavs.LunaticLover
                    joblist.LunaticLover++
                    frees--
            else if playersnumber>=17
                rval = 1
                while Math.random() < rval
                    if Math.random()<0.12 && !nonavs.Cupid
                        joblist.Cupid++
                        frees--
                    else if Math.random()<0.06 && !nonavs.Lover
                        joblist.Lover++
                        frees--
                    else if Math.random()<0.07 && !nonavs.SnowLover
                        joblist.SnowLover++
                        frees--
                    else if Math.random()<0.04 && !nonavs.BadLady
                        joblist.BadLady++
                        frees--
                    else if Math.random()<0.08 && !nonavs.LunaticLover
                        joblist.LunaticLover++
                        frees--
                    else
                        break
                    rval *= 0.6
        exceptions.push "Cupid", "Lover", "BadLady", "Patissiere", "SnowLover", "LunaticLover"
        # 決闘者陣営
        if frees>0
            if playersnumber<9
                addTeamToExceptions "Duel"
            else if playersnumber<12
                if Math.random()<0.50
                    addTeamToExceptions "Duel"

    # 独立推荐把占卜保底合入原高安全性步骤，不在运行算法前另塞一名。
    # 保留原步骤普通占卜师 75% 的概率，其余 25% 平分给 SP 与无谋。
    # 实际游戏开局未开启此选项，仍走原来的职业选择函数。
    # 三选一只占一个名额，已有这三种职业之一时不再补另一名。
    hasRequiredDiviner = joblist.Diviner > 0 || (guaranteeDiviner && (joblist.SuperDiviner > 0 || joblist.MumouDiviner > 0))
    if (safety.teams || safety.jobs) && !hasRequiredDiviner
        # 村人陣営
        # 占い師いてほしい
        selected = if guaranteeDiviner
            # 保底一次抽签必定选中一名，不叠加第二次保底。
            roll = Math.random()
            if roll < 0.75 then "Diviner"
            else if roll < 0.875 then "SuperDiviner"
            else "MumouDiviner"
        else if safety.jobs
            selectJob ["Diviner", "ApprenticeSeer"], [0.75, 0.05]
        else
            selectJob ["Diviner"], [0.75]
        if selected?
            if joblist.category_Human > 0
                joblist[selected]++
                joblist.category_Human--
            else if joblist.team_Human > 0
                joblist[selected]++
                joblist.team_Human--
            else if frees > 0
                joblist[selected]++
                frees--
    if safety.teams && (joblist.Guard + joblist.WanderingGuard == 0)
        # できれば狩人も
        selected = if joblist.Diviner > 0 then selectJob ["Guard", "WanderingGuard"], [0.4, 0.1]
        else selectJob ["Guard"], [0.4]
        if selected?
            if joblist.category_Human > 0
                joblist[selected]++
                joblist.category_Human--
            else if joblist.team_Human > 0
                joblist[selected]++
                joblist.team_Human--
            else if frees > 0
                joblist[selected]++
                frees--
    ((date)->
        month=date.getMonth()
        d=date.getDate()
        # 期間機率提升
        if month==11 && 24<=d<=25
            # 12/24〜12/25はサンタがよくでる
            if Math.random()<0.4 && frees>0 && !nonavs.SantaClaus
                joblist.SantaClaus ?= 0
                joblist.SantaClaus++
                frees--
                # トナカイもいるぞ
                if Math.random() < 0.4 && frees > 0 && !nonavs.Reindeer
                    joblist.Reindeer ?= 0
                    joblist.Reindeer++
                    frees--
            # 御子も出やすい
            if Math.random()<0.4 && frees>0 && !nonavs.Saint
                joblist.Saint ?= 0
                joblist.Saint++
                frees--
        else
            # サンタは出にくい
            if Math.random()<0.8
                exceptions.push "SantaClaus"
        unless month==6 && 26<=d || month==7 && d<=16
            # 期間外は花火師は出にくい
            if Math.random()<0.7
                exceptions.push "Pyrotechnist"
        else
            # ちょっと出やすい
            if Math.random()<0.11 && frees>0 && !nonavs.Pyrotechnist
                joblist.Pyrotechnist ?= 0
                joblist.Pyrotechnist++
                frees--
        if month==11 && 24<=d<=25 || month==1 && d==14
            # 爆弾魔がでやすい
            if Math.random()<0.5 && frees>0 && !nonavs.Bomber
                joblist.Bomber ?= 0
                joblist.Bomber++
                frees--
        if month==1 && 13<=d<=14
            # パティシエールが出やすい
            if Math.random()<0.4 && frees>0 && !nonavs.Patissiere
                joblist.Patissiere ?= 0
                joblist.Patissiere++
                frees--
        else
            # 出にくい
            if Math.random()<0.84
                exceptions.push "Patissiere"
        if month==0 && d<=3
            # 正月は巫女がでやすい
            if Math.random()<0.35 && frees>0 && !nonavs.Miko
                joblist.Miko ?= 0
                joblist.Miko++
                frees--
        if month==3 && d==1
            # 4月1日は嘘つきがでやすい
            if Math.random()<0.5 && !nonavs.Liar
                while frees>0
                    joblist.Liar ?= 0
                    joblist.Liar++
                    frees--
                    if Math.random()<0.75
                        break
        if month==11 && d==31 || month==0 && 4<=d<=7
            # 獅子舞の季節
            if Math.random()<0.5 && frees>0 && !nonavs.Shishimai
                joblist.Shishimai ?= 0
                joblist.Shishimai++
                frees--
        else if month==0 && 1<=d<=3
            # 獅子舞の季節（真）
            if Math.random()<0.7 && frees>0 && !nonavs.Shishimai
                joblist.Shishimai ?= 0
                joblist.Shishimai++
                frees--
        else
            # 獅子舞がでにくい季節
            if Math.random()<0.8
                exceptions.push "Shishimai"

        if month==9 && 30<=d<=31
            # ハロウィンっぽい役職
            if Math.random()<0.15 && frees>0 && !nonavs.Pumpkin
                joblist.Pumpkin ?= 0
                joblist.Pumpkin++
                frees--
            else if Math.random()<0.25 && frees>0 && !nonavs.Disguised
                joblist.Disguised ?= 0
                joblist.Disguised++
                frees--
            else if Math.random()<0.15 && frees>0 && !nonavs.TinyGhost
                joblist.TinyGhost ?= 0
                joblist.TinyGhost++
                frees--
            else if Math.random()<0.15 && frees>0 && !nonavs.Witch
                joblist.Witch ?= 0
                joblist.Witch++
                frees--
        else
            if Math.random()<0.2
                exceptions.push "Pumpkin"

        if (month==9 && 28<=d<=31) || (month==11 && 24<=d<=25) || (month==11 && d==31)
            # 暴徒が出る季節
            r = if month == 9 && d == 28
                # 軽トラ記念日
                0.4
            else
                0.2

            if Math.random()<r && frees>0 && !nonavs.Hooligan && !(joblist.Hooligan > 0)
                joblist.Hooligan ?= 0
                joblist.Hooligan++
                frees--
        else
            if Math.random()<0.4
                exceptions.push "Hooligan"

        if (month==11 && 29<=d) || (month==0 && d<=3) || (month==7 && 12<=d<=15)
            # 正月とお盆：帰省者が出現しやすい
            if Math.random()<0.11 && frees>0 && !nonavs.HomeComer
                joblist.HomeComer ?= 0
                joblist.HomeComer++
                frees--
        else
            if Math.random()<0.15
                exceptions.push "HomeComer"

        if month == 1 && d == 3
            # 節分: 鬼系が出やすい
            r = Math.random()
            if r < 0.2 && frees > 0 && !nonavs.Oni
                joblist.Oni ?= 0
                joblist.Oni++
                frees--
            else if r < 0.3 && frees > 0 && !nonavs.GoldOni
                joblist.GoldOni ?= 0
                joblist.GoldOni++
                frees--
            else if r < 0.4 && frees > 0 && !nonavs.GoldOni
                joblist.FrontOni ?= 0
                joblist.FrontOni++
                frees--
            else if r < 0.5 && frees > 0 && !nonavs.GoldOni
                joblist.BackOni ?= 0
                joblist.BackOni++
                frees--
    )(new Date)

    possibility=Object.keys(jobs).filter (x)->!(x in exceptions) && !(x in fixedJobs)
    if possibility.length == 0 && minHumanTeam?
        # 第三方限制可能清空普通候选池；用村人阵营分类的同一筛选条件补位，
        # 避免原有 Human 兜底突破独立推荐固定的村人数。
        possibility = Shared.game.teams.Human.filter (job)->
            !(job in excluded_exceptions) && !(job in special_exceptions) && !(job in fixedJobs)
    if possibility.length == 0
        # 0はまずい
        possibility.push "Human"

    # 強制的に入れる関数
    init=(jobname, categoryname, teamname)->
        unless jobname in possibility
            return false
        if categoryname? && joblist["category_#{categoryname}"]>0
            # あった
            joblist[jobname]++
            joblist["category_#{categoryname}"]--
            return true
        if teamname? && joblist["team_#{teamname}"] > 0
            joblist[jobname]++
            joblist["team_#{teamname}"]--
            return true
        if frees>0
            # あった
            joblist[jobname]++
            frees--
            return true
        return false
    initPrincessForQueen = ->
        if joblist.Princess > 0 || "Princess" in excluded_exceptions || "Human" in excluded_exceptions
            return false
        if joblist.category_Human > 0
            joblist.Princess++
            joblist.category_Human--
            return true
        if joblist.team_Human > 0
            joblist.Princess++
            joblist.team_Human--
            return true
        if frees > 0
            joblist.Princess++
            frees--
            return true
        false

    # セーフティ超用
    trial_count=0
    trial_max=if safety.strength then 40 else 1
    best_list=null
    best_points=null
    if safety.reverse
        best_diff=-Infinity
    else
        best_diff=Infinity
    first_list=joblist
    first_frees=frees
    # チームのやつキャッシュ
    teamCache={}
    getTeam=(job)->
        if teamCache[job]?
            return teamCache[job]
        for team of Shared.game.teams
            if job in Shared.game.teams[team]
                teamCache[job]=team
                return team
        return null
    while trial_count++ < trial_max
        joblist=copyObject first_list
        #wolf_teams=countCategory "Werewolf"
        wolf_teams=0
        frees=first_frees
        category = null
        job = null
        team = null
        sub_counter = 0
        while sub_counter++ < 300
            # 前のループで確保したものが残っていたら返す
            if category? || team?
                if category?
                    joblist[category]++
                if team?
                    joblist[team]++
            else if job?
                # jobが決まったけど使われなかった
                frees++
            category = null
            team = null
            job = null
            #カテゴリ役職がまだあるか探す
            for type,arr of Shared.game.categories
                if joblist["category_#{type}"]>0
                    # カテゴリの中から候補をしぼる
                    arr2 = arr.filter (x)->!(x in excluded_exceptions) && !(x in special_exceptions) && !(x in fixedJobs)
                    if arr2.length > 0
                        r=Math.floor Math.random()*arr2.length
                        job=arr2[r]
                        category="category_#{type}"
                        # カテゴリを先に消費
                        joblist[category]--
                        break
                    else
                        # これもう無理だわ
                        frees += joblist["category_#{type}"]
                        joblist["category_#{type}"] = 0
            # same for teams
            unless job?
                for type,arr of Shared.game.teams
                    if joblist["team_#{type}"]>0
                        arr2 = arr.filter (x)->!(x in excluded_exceptions) && !(x in special_exceptions) && !(x in fixedJobs)
                        if arr2.length > 0
                            r=Math.floor Math.random()*arr2.length
                            job=arr2[r]
                            team="team_#{type}"
                            joblist[team]--
                            break
                        else
                            frees += joblist["team_#{type}"]
                            joblist["team_#{type}"] = 0
            unless job?
                # もうカテゴリがない
                if frees<=0
                    # もう空きがない
                    break
                r=Math.floor Math.random()*possibility.length
                job=possibility[r]
                # 一般枠を使ったのでfreesを消費
                frees--
            if (safety.teams || safety.ppcheck) && !category?
                if job in Shared.game.teams.Werewolf
                    if wolf_teams+1>=plsh
                        # 人狼が過半数を越えた（PP）
                        continue
            if safety.jobs
                # 職どうしの兼ね合いを考慮
                switch job
                    when "Psychic","RedHood"
                        # 1人のとき霊能は意味ない
                        if countCategory("Werewolf")==1
                            # 狼1人だと霊能が意味ない
                            continue
                    when "Couple"
                        # 共有者はひとりだと寂しい
                        if joblist.Couple==0
                            unless init "Couple","Human","Human"
                                #共有者が入る隙間はない
                                continue
                    when "Twin"
                        # 双子も
                        if joblist.Twin==0
                            unless init "Twin","Human","Human"
                                continue
                    when "MadCouple"
                        # 叫迷も
                        if joblist.MadCouple==0
                            unless init "MadCouple","Madman","Werewolf"
                                #共有者が入る隙間はない
                                continue
                    when "Noble"
                        # 貴族は奴隷がほしい
                        if joblist.Slave==0
                            unless init "Slave","Human","Human"
                                continue
                    when "Slave"
                        if joblist.Noble==0
                            unless init "Noble","Human","Human"
                                continue
                    when "OccultMania"
                        if joblist.Diviner==0 && Math.random()<0.5
                            # 占い師いないと出現確率低い
                            continue
                    when "QueenSpectator"
                        # 2人いたらだめ
                        if joblist.QueenSpectator>0 || joblist.Spy2>0 || joblist.BloodyMary>0
                            continue
                        if Math.random()>0.1
                            # 90%の確率で弾く
                            continue
                        # 女王観戦者はガードがないと不安
                        if joblist.Guard==0 && joblist.Priest==0 && joblist.Trapper==0
                            unless Math.random()<0.4 && init "Guard","Human", "Human"
                                unless Math.random()<0.5 && init "Priest","Human"
                                    unless init "Trapper","Human", "Human"
                                        # 護衛がいない
                                        continue
                        if Math.random() < 0.2
                            initPrincessForQueen()
                    when "Princess"
                        # safety.jobsでは公主単独のランダム生成はさせない
                        continue
                    when "Spy2"
                        # スパイIIは2人いるとかわいそうなので入れない
                        if joblist.Spy2>0 || joblist.QueenSpectator>0 || joblist.Princess>0
                            continue
                        else if Math.random()>0.1
                            # 90%の確率で弾く（レア）
                            continue
                    when "MadWolf"
                        if Math.random()>0.1
                            # 90%の確率で弾く（レア）
                            continue
                    when "Lycan","SeersMama","Sorcerer","WolfBoy","ObstructiveMad","Satori","Fate"
                        # 占い系がいないと入れない
                        if joblist.Diviner==0 && joblist.ApprenticeSeer==0 && joblist.PI==0
                            continue
                    when "LoneWolf","FascinatingWolf","ToughWolf","WolfCub"
                        # 誘惑する女狼はほかに人狼がいないと効果発揮しない
                        # 一途な狼はほかに狼いないと微妙、一匹狼は1人だけででると狂人が絶望
                        if countCategory("Werewolf")==0
                            continue
                    when "BigWolf"
                        # 強いので狼2以上
                        if countCategory("Werewolf")==0
                            continue
                        # 霊能を出す
                        unless Math.random()<0.15 ||  init "Psychic","Human"
                            continue
                    when "BloodyMary"
                        # 狼が2以上必要
                        if countCategory("Werewolf")<=1
                            continue
                        # 女王とは共存できない
                        if joblist.QueenSpectator>0 || joblist.Princess>0
                            continue
                    when "SpiritPossessed"
                        # 2人いるとうるさい
                        if joblist.SpiritPossessed > 0
                            continue
                    when "Raven"
                        # 鴉は最低2人セット
                        if joblist.Raven == 0
                            unless init "Raven","Others", "Raven"
                                continue
                            if playersnumber >= 16
                                # 16人以上だと3人セットにしちゃう
                                init "Raven", "Others", "Raven"
                    when "Ascetic"
                        # 鴉がいないと出ない（実質鴉が2配役以上で出現条件を満たす）
                        if joblist.Raven==0
                            continue
                    when "HimeFox"
                        # 姫狐が出るときは必ず念缚灵能者を出す
                        unless init "MindPsychic","Human"
                            continue
            # 絶対狼はセーフティに関わらず処理を実施する
            if job == "AbsoluteWolf"
                # 人狼系が2以上且つ人狼数と絶対狼数は一致しないこと
                if countCategory("Werewolf")==0 || countCategory("Werewolf") == joblist.AbsoluteWolf
                    continue
                # 一匹狼とは共存できない
                if joblist.LoneWolf>0
                    continue
            if job == "LoneWolf"
                # 絶対狼とは共存できない
                if joblist.AbsoluteWolf>0
                    continue
            if job == "Reindeer"
                # トナカイはサンタ無しで出さない
                if joblist.SantaClaus == 0
                    continue
            # ローレライ
            if job == "Lorelei"
                # 13人未満では配役しない
                if playersnumber<13
                    continue
                else
                    # ローレライは2人以上出さない
                    possibility = possibility.filter (x)-> x != "Lorelei"
                    special_exceptions.push "Lorelei"

            joblist[job]++
            if job == "MadWolf"
                # 狂人狼は2人以上出さない調整
                possibility = possibility.filter (x)-> x != "MadWolf"
                special_exceptions.push "MadWolf"

            if (safety.teams || safety.ppcheck) && (job in Shared.game.teams.Werewolf)
                wolf_teams++    # 人狼陣営が増えた

            # ひとつ追加
            if category?
                # カテゴリの消費に成功した
                category = null
            if team?
                team = null
            # 追加に成功した
            job = null

        # セーフティ超の場合判定が入る
        if safety.strength
            # ポイントを計算する
            points=
                Human:0
                Werewolf:0
                Others:0
            for job of jobStrength
                if joblist[job]>0
                    switch getTeam(job)
                        when "Human"
                            points.Human+=jobStrength[job]*joblist[job]
                        when "Werewolf"
                            points.Werewolf+=jobStrength[job]*joblist[job]
                        else
                            points.Others+=jobStrength[job]*joblist[job]
            # 判定する
            if points.Others>points.Human || points.Others>points.Werewolf
                # だめだめ
                continue
            # jgs=Math.sqrt(points.Werewolf*points.Werewolf+points.Others*points.Others)
            jgs = points.Werewolf+points.Others
            diff=Math.abs(points.Human-jgs)
            if safety.reverse
                # 逆
                diff+=points.Others
                if diff>best_diff
                    best_list=copyObject joblist
                    best_diff=diff
                    best_points=points
            else
                if diff<best_diff
                    best_list=copyObject joblist
                    best_diff=diff
                    best_points=points
                    #console.log "diff:#{diff}"
                    #console.log best_list

    if safety.strength && best_list?
        # セーフティ超
        joblist=best_list
    {joblist, excluded_exceptions}
