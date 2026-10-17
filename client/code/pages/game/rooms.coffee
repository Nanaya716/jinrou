rooms_view = null
exports.start=(query={})->
    mode = query.mode
    page = query.page || 0
    noLinks = !!query.noLinks
    keyword = query.keyword ? ''
    if page < 0
        page = 0

    pi18n = JinrouFront.loadI18n()
        .then((i18n)-> i18n.getI18nFor())
    papp = JinrouFront.loadRoomList()
    prooms = requestRooms mode, page, keyword

    Promise.all([pi18n, papp]).then ([i18n, app])->
        rooms_view = app.place {
            i18n: i18n
            node: $("#rooms-app").get 0
            pageNumber: 10
            indexStart: page * 10 + 1
            listMode: mode ? ''
            noLinks: noLinks
            keyword: keyword
            onPageMove: (dist)->
                page += dist
                if page < 0
                    page = 0
                reqRpc()
                pushQuery =
                    page: page
                if keyword
                    pushQuery.keyword = keyword
                Index.app.pushState location.pathname, pushQuery
            onSearch: (nextKeyword)->
                keyword = nextKeyword
                page = 0
                reqRpc()
                pushQuery =
                    page: page
                if keyword
                    pushQuery.keyword = keyword
                Index.app.pushState location.pathname, pushQuery
            getJobColor: (job)->
                jobobj = Shared.game.getjobobj job
                jobobj?.color
        }
        prooms.then (result)->
            rooms_view.store.setRooms result.rooms, page, result.summary, result.userlog
            renderFavoriteUserlog i18n, mode, result.userlog

        reqRpc = ()->
            requestRooms(mode, page, keyword).then((result)->
                rooms_view.store.setRooms result.rooms, page, result.summary, result.userlog
                renderFavoriteUserlog i18n, mode, result.userlog
            ).catch (err)->
                console.error err
                rooms_view.store.setError()

# Request rooms and return result as Promise.
requestRooms = (mode, page, keyword = '')->
    new Promise (resolve, reject)->
        if mode == "favorites"
            ss.rpc "game.rooms.getFavoriteRooms", page, {keyword: keyword}, (results)->
                if results.error?
                    reject results.error
                else
                    roomResults = results.rooms ? results
                    summary = results.summary ? null
                    userlog = results.userlog ? null
                    resolve {
                        rooms: roomResults.map (obj)->
                            # align with other query's object structure
                            # (with additional properties)
                            room = obj.room
                            if obj.job? || obj.subtype?
                                room.gameinfo = {
                                    job: obj.job
                                    subtype: obj.subtype
                                }
                            return room
                        summary: summary
                        userlog: userlog
                    }
        else if mode == "my"
            ss.rpc "game.rooms.getMyRooms", page, (results)->
                if results.error?
                    reject results.error
                else
                    resolve {
                        rooms: results.map (obj)->
                            # align with other query's object structure
                            # (with additional properties)
                            room = obj.room
                            if obj.job? || obj.subtype?
                                room.gameinfo = {
                                    job: obj.job
                                    subtype: obj.subtype
                                }
                            return room
                        summary: null
                        userlog: null
                    }
        else
            ss.rpc "game.rooms.getRooms", mode, page, (rooms)->
                resolve {
                    rooms: rooms
                    summary: null
                    userlog: null
                }

exports.end = ->
  rooms_view?.unmount()

renderFavoriteUserlog = (i18n, mode, userlog)->
    return unless mode == "favorites"
    node = document.getElementById "favorite-userlog"
    return unless node?
    Index.user.mylog.showUserlog i18n, userlog, node
