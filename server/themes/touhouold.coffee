module.exports=
    name:"东方旧作"
    #
    opening:"夜になった…。月の明かりがまぶしいほどに輝いている。何かが起こりそうな予感がする、そんな夜だ。村人たちが昼間に話していた人狼の噂…。本当に人狼なんて、いるのだろうか？"
    # to let players know woh they are
    skin_tip:"你的身份"
    # 主题的作者
    author:"nobodycares"
    # 修改时间
    lastModified:"2025-12-4T18:31:33.917Z"
    vote:"aaaa"
    sunrise:"bbbbbb"
    sunset:"cccccc"
    icon:""
    background_color:"black"
    color:"rgb(255,0,166)"
    lockable:true
    isAvailable:->
        # 如果想要做成有某种限制条件
        # return false
        return true
    skins:
        # 罗马字名 ，只允许半角英数字和下划线，数字和下划线不允许是首位
        # 不可以重复
        Reimu:
            # 头像链接 和 称号 可以是字符串数组，也可以是字符串
            # 头像在显示的时候 会压缩为48*48，所以最好纵横比是1:1
            avatar:"https://s2.loli.net/2026/02/03/UhEq7jXstJLzrPH.png" # 头像链接
            name:"博丽灵梦" # 名字，必填
            prize:["维护梦与传统的巫女","巫女小姐"] # 称号
        Marisa:
            avatar:["https://s2.loli.net/2026/02/03/t53zqplFbSKa4JN.png","https://s2.loli.net/2026/02/03/cSNC46HpMZT5ue8.png"]
            name:"霧雨魔梨沙"
            prize:["从魔法与红梦化成的存在","魔法使小姐"] # 称号是允许留空的
        SinGyoku:
            avatar:["https://s2.loli.net/2026/02/03/4uW9Brt8H7TLVMJ.png","https://s2.loli.net/2026/02/03/hHzgidw5PZjf2Eo.png","https://s2.loli.net/2026/02/03/dGf8NTsuqvohRU4.png"]
            name:"神玉"
            prize:"Gatekeeper" # 称号是允许留空的
        YuugenMagan:
            avatar:"https://s2.loli.net/2026/02/03/XbKCamYGvtpsoZf.png"
            name:"幽玄魔眼"
            prize:"Evil Eyes" # 称号是允许留空的
        Mima:
            avatar:"https://s2.loli.net/2026/02/03/wGHK183kjmxWJ5X.png"
            name:"魅魔"
            prize:["Revengeful Ghost","将命运托付给久远的梦的精神","恶灵小姐","恶灵","幽灵"] # 称号是允许留空的
        Elis:
            avatar:"https://s2.loli.net/2026/02/03/9MOwbC3hyRe6iLt.png"
            name:"依莉斯"
            prize:"Innocent Devil" # 称号是允许留空的
        Kikuri:
            avatar:"https://s2.loli.net/2026/02/03/78axpY5zWAVeS3j.png"
            name:"菊理"
            prize:"Hellish Moon" # 称号是允许留空的
        Sariel:
            avatar:"https://s2.loli.net/2026/02/03/EmbVgd5LjzWY4wy.png"
            name:"萨丽爱尔"
            prize:"Angel of Death" # 称号是允许留空的
        Konngara:
            avatar:"https://s2.loli.net/2026/02/03/Wz4IFjXJi1ClQ5H.png"
            name:"矜羯罗"
            prize:"Astral Knight" # 称号是允许留空的
        jingling:
            avatar:"https://s2.loli.net/2026/02/03/vtdI5fbeKL6wMgq.png"
            name:"小精灵"
            prize:"" # 称号是允许留空的
        shanbu:
            avatar:"https://s2.loli.net/2026/02/03/5RxLMHTIOw1ovp8.png"
            name:"山步"
            prize:"" # 称号是允许留空的
        sensha:
            avatar:"https://s2.loli.net/2026/02/03/pBkfd73etORW4TX.png"
            name:"战车"
            prize:"" # 称号是允许留空的
        Rika:
            avatar:["https://s2.loli.net/2026/02/03/VYrvDSU7Teld2Pj.png","https://s2.loli.net/2026/02/03/vLZxIRXjGOuisgY.png"]
            name:"里香"
            prize:"工程师" # 称号是允许留空的
        FlowerSensha:
            avatar:"https://s2.loli.net/2026/02/03/GYCrTu5pMDek9Ps.png"
            name:"Flower战车"
            prize:"" # 称号是允许留空的
        zuzhou:
            avatar:"https://s2.loli.net/2026/02/03/9nyziZYL7vUI8b4.png"
            name:"诅咒子"
            prize:"" # 称号是允许留空的
        Meira:
            avatar:"https://s2.loli.net/2026/02/03/b1lTz5AZyUiBtOY.png"
            name:"明罗"
            prize:"武士" # 称号是允许留空的
        huanmeng:
            avatar:"https://s2.loli.net/2026/02/03/Vk7Sz2Ap4hDWEld.png"
            name:"幻梦盘"
            prize:"" # 称号是允许留空的
        motianshi:
            avatar:"https://s2.loli.net/2026/02/03/7Mm8RXx2s9eQn4C.png"
            name:"魔天使"
            prize:"" # 称号是允许留空的
        Sigma:
            avatar:"https://s2.loli.net/2026/02/03/k7z58ZD9QM2bLlr.png"
            name:"邪眼西格玛"
            prize:"" # 称号是允许留空的
        Ellen:
            avatar:"https://s2.loli.net/2026/02/03/Y7u2Ml8nZBAmE9t.png"
            name:"爱莲"
            prize:["勤奋工作并梦想着恋爱的魔女","魔女"] # 称号是允许留空的
        Kotohime:
            avatar:"https://s2.loli.net/2026/02/03/PBsEFqnQ6YydH7N.png"
            name:"小兔姬"
            prize:["在弹幕中梦见美的公主","公主殿下？","公主"] # 称号是允许留空的
        Kana:
            avatar:"https://s2.loli.net/2026/02/03/IaWPOiqj2NClueF.png"
            name:"卡娜·安娜贝拉尔"
            prize:["失去梦的少女骚灵","骚灵"] # 称号是允许留空的
        Rikako:
            avatar:"https://s2.loli.net/2026/02/03/rZCgPWtczFbpw5T.png"
            name:"朝仓理香子"
            prize:["寻找梦想的科学","科学信者","科学家"] # 称号是允许留空的
        Chiyuri:
            avatar:"https://s2.loli.net/2026/02/03/Lkh2lHVbWIaBK84.png"
            name:"北白河千百合"
            prize:["超越时空的梦幻居民","教授助理"] # 称号是允许留空的
        Yumemi:
            avatar:"https://s2.loli.net/2026/02/03/brXWkZx1RgDSJ9Y.png"
            name:"冈崎梦美"
            prize:["梦幻传说","教授"] # 称号是允许留空的
        Sokuratesu:
            avatar:"https://s2.loli.net/2026/02/03/sPJ1mrMdKEBGpR6.png"
            name:"苏格拉底"
            prize:"" # 称号是允许留空的
        Genjii:
            avatar:"https://s2.loli.net/2026/02/03/H1xkCQqDmU3XujB.png"
            name:"玄爷"
            prize:"龟" # 称号是允许留空的
        Rukoto:
            avatar:"https://s2.loli.net/2026/02/03/dRQrnXJ61Bhbzsj.png"
            name:"留琴"
            prize:"" # 称号是允许留空的
        Mamaruchi:
            avatar:"https://s2.loli.net/2026/02/03/6QW9bfazP31kwX4.png"
            name:"玛O奇"
            prize:"" # 称号是允许留空的
        Mimichan:
            avatar:"https://s2.loli.net/2026/02/03/j5lPD4UizEqYAbQ.png"
            name:"咪咪号"
            prize:"" # 称号是允许留空的
        lianhua:
            avatar:"https://s2.loli.net/2026/02/03/DUtfhwEPv8Ixjqi.png"
            name:"妖莲花"
            prize:"" # 称号是允许留空的
        Kurumi:
            avatar:"https://s2.loli.net/2026/02/03/bHtlEr7mxkLvVqQ.png"
            name:"胡桃"
            prize:["吸血少女","吸血鬼"] # 称号是允许留空的
        mojing:
            avatar:"https://s2.loli.net/2026/02/03/wNi8QUu7MHKATIZ.png"
            name:"魔镜"
            prize:"" # 称号是允许留空的
        guangzi:
            avatar:["https://s2.loli.net/2026/02/03/u3Rhi7HcEOFblAL.png","https://s2.loli.net/2026/02/03/WqcC7vkVENta39m.png"]
            name:"光子"
            prize:"" # 称号是允许留空的
        Orange:
            avatar:"https://s2.loli.net/2026/02/03/1g7yL24d6iqp3TQ.png"
            name:"奥莲姬"
            prize:["妖怪","东方的恶魔"] # 称号是允许留空的
        Elly:
            avatar:"https://s2.loli.net/2026/02/03/Rrke4FXNA1YgmpI.png"
            name:"艾丽"
            prize:["馆的门卫","门卫"] # 称号是允许留空的
        Yuka:
            avatar:"https://s2.loli.net/2026/02/03/JITCMhKsjR3Z7Bd.png"
            name:"幽香"
            prize:["妖怪","妖怪小姐","东方的恶魔"] # 称号是允许留空的
        Mugetsu:
            avatar:"https://s2.loli.net/2026/02/03/eCk2E5i4yNYTMWQ.png"
            name:"梦月"
            prize:"女仆" # 称号是允许留空的
        Gengetsu:
            avatar:"https://s2.loli.net/2026/02/03/rehlGQFmuXWR4o1.png"
            name:"幻月"
            prize:"恶魔" # 称号是允许留空的
        lunyaojing:
            avatar:"https://s2.loli.net/2026/02/03/NpWX3eh9KjH8JZ5.png"
            name:"轮妖精"
            prize:"" # 称号是允许留空的
        Sara:
            avatar:"https://s2.loli.net/2026/02/03/tLAcyK21WgMl5CB.png"
            name:"萨拉"
            prize:["门之看守","魔界的门卫","门卫"] # 称号是允许留空的
        shenjing:
            avatar:"https://s2.loli.net/2026/02/03/kuPEBz2Uab5IWrA.png"
            name:"神镜"
            prize:"" # 称号是允许留空的
        Louise:
            avatar:"https://s2.loli.net/2026/02/03/3L9SDuy1I7NXYpg.png"
            name:"露易兹"
            prize:["恶魔","魔界人"] # 称号是允许留空的
        luxiya:
            avatar:"https://s2.loli.net/2026/02/03/EaqC48RIvJmuBnN.png"
            name:"露西亚"
            prize:"" # 称号是允许留空的
        Alice:
            avatar:"https://s2.loli.net/2026/02/03/YEQhmyj5J3t8xs1.png"
            name:"爱丽丝"
            prize:["死之少女","魔法之国的爱丽丝","Witch of Death"] # 称号是允许留空的
        Yuki:
            avatar:"https://s2.loli.net/2026/02/03/iebD2ow68YWNcsH.png"
            name:"雪"
            prize:["魔法使","黑色魔女"] # 称号是允许留空的
        Mai:
            avatar:"https://s2.loli.net/2026/02/03/sd9tQGbxuzIALZw.png"
            name:"舞"
            prize:["魔法使","白色魔女"] # 称号是允许留空的
        yaonai:
            avatar:"https://s2.loli.net/2026/02/03/s1fUdDKzbpyIuX4.png"
            name:"妖奈"
            prize:"" # 称号是允许留空的
        Yumeko:
            avatar:"https://s2.loli.net/2026/02/03/Z6VrCQRjSYdI8wh.png"
            name:"梦子"
            prize:["魔界女仆","女仆"] # 称号是允许留空的
        Shinki:
            avatar:"https://s2.loli.net/2026/02/03/lC3cjJm87YKMTXu.png"
            name:"神绮"
            prize:["魔界之神","魔界女神"] # 称号是允许留空的
        King:
            avatar:"https://s2.loli.net/2026/02/03/iHXoQ3EVa9pCL5W.png"
            name:"王牌"
            prize:"" # 称号是允许留空的
        A:
            avatar:"https://s2.loli.net/2026/02/03/ImE6Aerda5gBlXw.png"
            name:"魔界人Ａ"
            prize:"" # 称号是允许留空的
        B:
            avatar:"https://s2.loli.net/2026/02/03/bi4W35UCNJPej7V.png"
            name:"魔界人Ｂ"
            prize:"" # 称号是允许留空的
        anoko:
            avatar:"https://s2.loli.net/2026/02/03/W9dHVFJKq7ubksT.png"
            name:"夹克子"
            prize:"" # 称号是允许留空的
        Rin:
            avatar:"https://s2.loli.net/2026/02/03/oluxAeqdn12J3BI.png"
            name:"冴月麟"
            prize:"" # 称号是允许留空的
