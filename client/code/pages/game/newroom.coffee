app = require '/app'
newroom_view = null
exports.start = ({themes})->
    pi18n = app.getI18n()
    pconfig = app.getApplicationConfig()
    papp = JinrouFront.loadNewRoom()
    Promise.all([pi18n, pconfig, papp]).then ([i18n, config, japp])->
        newroom_view = japp.place {
            i18n: i18n
            node: $("#newroom-app").get 0
            themes: themes
            roomDefaults: config.roomDefaults
            onCreate: (query)->
                new Promise (resolve, reject)->
                    ss.rpc "game.rooms.newRoom", query, (result)->
                        if result?.error?
                            reject result.error
                        else
                            Index.app.showUrl "/room/#{result.id}"
                            resolve()
        }

exports.end = ->
    newroom_view?.unmount()
