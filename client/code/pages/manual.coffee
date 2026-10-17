exports.start=->
	form=$("#gm-test-form")
	if form.get 0
		form.bind "submit",(event)->
			event.preventDefault()
			correct=0
			form.find("fieldset").each ->
				fieldset=$(this)
				answer=fieldset.data("answer").split(",")
				selected=fieldset.find("input:checked").map(-> this.value).get().sort()
				isCorrect=answer.length is selected.length and answer.every (value,index)-> value is selected[index]
				fieldset.toggleClass "is-correct",isCorrect
				fieldset.toggleClass "is-incorrect",not isCorrect
				fieldset.find(".result").text if isCorrect then "回答正确。" else "回答错误。正确答案：#{answer.join('、')}。"
				fieldset.find(".explanation").show()
				correct++ if isCorrect
			form.find("#gm-test-summary").text "答对 #{correct} / #{form.find('fieldset').length} 题。可直接修改答案后再次确认。"
	# 役職数
	$("#number_of_jobs").text Shared.game.jobs.length

	# 役職一覧ページ
	j=$("#joblist_main")
	if j.get 0
        # list up all jobs.
        Promise.all([
            JinrouFront.loadI18n().then((i18n)-> i18n.getI18nFor()),
            JinrouFront.loadManual().then((manual)->
                # preload manual data.
                manual.loadRoleManual('Human').then(()->
                    Promise.all(Shared.game.jobs.map((job)->
                        manual.loadRoleManual(job)
                            .then((data)->
                                [job, data]))))
                )
        ])
            .then ([i18n, roles])->
                for [roleid, renderer] in roles
                    sec = $ "<section class='jobmanual'>"
                    title = $("<h1>").text i18n.t "roles:jobname.#{roleid}"
                    sec.append title
                    sec.append $(renderer())
                    j.append sec
	# 一番上にスクロール
	window.scrollTo 0,0





exports.end=->

