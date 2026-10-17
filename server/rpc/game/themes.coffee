# example at server/themes/example.coffee
fs=require 'fs'

themes={}
getThemes=()->
    themeFiles = fs.readdirSync "server/themes/"
    # not the example
    themeFiles=themeFiles.filter (n)->n!="example.coffee"
    themes={}
    for themeFile in themeFiles
        unless themeFile.match(/\.coffee$/) == null
            name = themeFile.replace /\.coffee$/, ""
            try
                delete require.cache[require.resolve("../../themes/#{name}.coffee")]
                themes[name] = require "../../themes/#{name}.coffee"
            catch e
                console.error e
# load themes
getThemes()

# if any changes
fs.watch "server/themes/",(e)->
    getThemes()

module.exports =
    getTheme:(name)->
        if themes[name] != undefined
            return themes[name]
        themeFiles = fs.readdirSync "server/themes/"
        # not the example
        themeFiles=themeFiles.filter (n)->n!="example.coffee"

        if "#{name}.coffee" in themeFiles
            try
                theme = require "../../themes/#{name}.coffee"
            catch e
                console.log e
                theme = null
            return theme
        return null

    # 获取所有可用主题（用于 OpenAvatar 模式）
    getAllThemesForOpenAvatar:->
        availableThemes = []
        for name, theme of themes
            # 跳过 openavatar 自身
            continue if name == 'openavatar'
            # 只返回可用主题
            if theme.isAvailable?()
                availableThemes.push {
                    name: name
                    fullName: theme.name
                    skins: theme.skins
                }
        return availableThemes

module.exports.actions =(req,res,ss)->
    req.use 'user.fire.wall'
    req.use 'session'
    getThemeList:->
        results=[]
        try
            for t of themes
                # 过滤掉 openavatar 主题（它是特殊的跨主题选择模式，不应该作为普通主题出现）
                continue if t == 'openavatar'
                results.push {
                    value:t
                    name:themes[t].name
                    update:new Date(themes[t].lastModified || 0)
                }
            results.sort (a,b) =>
                return b.update - a.update
            res results
        catch e
            res {error:e}

    # 获取所有主题的所有角色（用于 OpenAvatar 模式）
    getAllThemesSkins:->
        try
            allSkins = []
            for themeName, theme of themes
                # 跳过 openavatar 主题本身
                continue if themeName == 'openavatar'
                # 检查主题是否可用
                if theme.isAvailable?()
                    if theme.skins
                        for skinKey, skin of theme.skins
                            allSkins.push {
                                theme: themeName
                                themeName: theme.name
                                skinKey: skinKey
                                name: skin.name
                                avatar: skin.avatar
                                prize: skin.prize || ""
                            }
            res allSkins
        catch e
            res {error: String(e)}
