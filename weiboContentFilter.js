var doc = document;
var body = doc.body;
var docElement = doc.documentElement;

var $version = 0.9;

var $ = (function() {
    var cached = {};
    var guid = 0;
    var scriptPrefix = 'wbpscript';
    var ArrayProto = Array.prototype;
    var slice = ArrayProto.slice;
    var push = ArrayProto.push;
    var each = ArrayProto.forEach;

    var $ = function(selector, context) {
        return new $.prototype.init(selector, context);
    };

    //static method
    $.create = function(tag) { //create element, with cache
        var el = cached[tag] || (cached[tag] = doc.createElement(tag));
        return el.cloneNode(false);
    };

    $.each = function(obj, fn) {
        var length = obj.length;
        if(typeof length != 'undefined') {
            for(var i=0; i<length; i++) {
                if(fn.call(obj[i], i, obj[i]) === false) {
                    break;
                }
            }
        } else {
            for(var i in obj) {
                if(fn.call(obj[i], i, obj[i]) === false) {
                    break;
                }
            }
        }
    };

    // TODO
    (function() {
        if (!window.chrome) {
            // 非Chrome浏览器，优先使用unsafeWindow获取全局变量
            // 由于varname中可能包括'.'，因此使用eval()获取变量值
            $.global = function (varname) {
                return unsafeWindow[varname];
            };
        } else {
            // Chrome原生不支持unsafeWindow，脚本运行在沙箱中，因此不能访问全局变量。
            // 但用户脚本与页面共享DOM，所以可以设法将脚本注入host页
            // 详见http://voodooattack.blogspot.com/2010/01/writing-google-chrome-extension-how-to.html
            $.global = function (varname) {
                var elem = $.create('script');
                // 生成脚本
                elem.id = scriptPrefix + (guid++);
                elem.type = 'text/javascript';
                elem.innerHTML = '(function(){document.getElementById("' + elem.id + '").innerText=' + varname + '; }());';
                // 将元素插入DOM（马上执行脚本）
                doc.head.appendChild(elem);
                // 获取返回值
                var ret = elem.innerText;
                // 移除元素
                doc.head.removeChild(elem);
                elem = null;
                return ret;
            };
        }
    })()

    //instance method
    $.prototype = {
        init : function(selector, context) {
            context = context || body;
            selector = typeof selector == 'string' ? doc.querySelectorAll(selector, context) : [selector];
            this.context = context;
            push.apply(this, selector);
        },

        length : 0,

        eq : function(index) {
            index = +index;
            return index  < 0 ? $(this[this.length + index]) : $(this[index]);
        },

        //CSS
        cssText : function(text) {
            if(typeof text == 'undefined') {
                return this[0].style.cssText;
            } else {
                $.each(this, function() {
                    this.style.cssText = text;
                })
                return this;
            }
        },
        //用于设置样式
        css : function(name, value) {
            if(typeof name == 'object') {
                $.each(this, function(i, el) {
                    $.each(name, function(styleName, styleValue) {
                        el.style[styleName] = styleValue;
                    })
                })
            } else {
                this.style[name] = value;
                return this;
            }
        },

        //prop
        prop : function(name, value) {
            if(typeof name == 'object') {
                $.each(this, function(i, el) {
                    $.each(name, function(propName, propValue) {
                        el[propName] = propValue;
                    })
                })
                return this;
            } else {
                if(typeof value == 'undefined') {
                    return this[0][name];
                } else {
                    $.each(this, function() {
                        this[name] = value;
                    })
                    return this;
                }
            }
        },

        //DOM
        children : function(index) {
            var children = this[0].children;
            var len = children.length;
            index = index > len ? (index < 0 ? (len + index) : index) : len - 1;
            return $(children[index]);
        },

        append : function(child) {
            child = child.length ? child[0] : child; //只操作第一个元素
            $.each(this, function() {
                this.appendChild(child);
            })
            return this;
        },

        html : function(value) {
            if(typeof value == 'undefined') {
                return this[0] && this[0].innerHTML;
            } else {
                $.each(this, function() {
                    this.innerHTML = value;
                })
                return this;
            }
        },

        text : function() {
            return this[0].textContent;
        },

        show : function(el) {
            el = el ? [el] : this;
            $.each(el, function() {
                this.style.display = 'block';
            })
            return this;
        },

        hide : function(el) {
            el = el ? [el] : this;
            $.each(el, function() {
                this.style.display = 'none';
            })
            return this;
        },

        //Event
        on : function(type, fn) {
            $.each(this, function() {
                this.addEventListener(type, fn, false);
            })
            return this;
        },

        click : function(fn) {
            this.on('click', fn);
            return this;
        },

        //AJAX
        ajax : function(config) {
            GM_xmlhttpRequest(config);
            return this;
        }
    };

    $.prototype.init.prototype = $.prototype;
    return $;
}())

var root = $(body);

var config = $.global('$CONFIG');
var wbp = {
    isWindowInitialed : false, //窗口初始化
    stk :$.global('STK'), //weibo框架
    $uid : 0,
    $reloadTimerID : 0,
    scope : config['pageid'] == 'content_home' ? 1 : config['pageid'] == 'content_hisWeibo' ? 2 : 0,

    init : function() {
        if(!this.scope) return;
        this.showSettingsBtn();
    },

    showSettingsBtn : function() {
        var that = this;
        var groups = $('#pl_content_homeFeed .nfTagB, #pl_content_hisFeed .nfTagB');
        // Firefox的div#pl_content_homeFeed载入时是空的，此时无法置入页面，稍后由onDOMNodeInsertion()处理
        if (groups.length == 0) {
            setTimeout(wbp.showSettingsBtn.bind(this), 10);
            return;
        }
        groups.children(0).append($($.create('li')).html('<span><em><a id="wbpShowSettings" href="javascript:void(0)">眼不见心不烦</a></em></span>'));
        var btn = $('#wbpShowSettings').click(function(e) {
            console.log(that);
            that.showSettingsWindow(e);
        });
        return true;
    },

    loadSettingsWindow : function() {
        if (this.isWindowInitialed) {return true; }
        this.isWindowInitialed = true;
        this.$uid = config['uid'];
        if (!this.$uid) {return false; }

        // 加入选项设置
        GM_addStyle('#wbpSettings p { line-height: 150%; } #wbpTabHeaders a { display: block; padding: 6px 0; text-align: center; text-decoration: none; } #wbpTabHeaders a:hover { background-color: #C6E8F4; } #wbpTabHeaders a.current { background-color: #79C5E9; color: white; cursor: default; } #wbpSettings .wbpInput { border: 1px solid #D2D5D8; padding: 0 2px; } #wbpSettings .wbpInput input { width: 100%; height: 22px; border: 0; padding: 0; margin: 0; display: block; } #wbpSettings .detail > div { margin-top: 15px; } #wbpTabModules input { vertical-align: middle; margin-right: 5px; } #wbpSettings .wbpKeywordBlock { margin-top: 10px; border: 1px solid #D2D5D8; padding: 8px 8px 0; } #wbpSettings .wbpKeywordBlock em { font-weight: bold; margin-right: 15px; } #wbpSettings .wbpKeywordList { margin-top: 8px; overflow: hidden; } #wbpSettings .wbpKeywordList a { margin: 0 5px 8px 0; padding: 0 4px; border: 1px solid; float: left; height: 18px; line-height: 18px; white-space: nowrap; } #wbpSettings .wbpKeywordList a:hover { text-decoration: none; } #wbpWhiteKeywordList a { border-color: #008000; color: #008000; } #wbpWhiteKeywordList a.regex { background-color: #80FF80; } #wbpWhiteKeywordList a:hover { border-color: #008000; background-color: #D0FFD0; } #wbpBlackKeywordList a, #wbpURLKeywordList a { border-color: #D00000; color: #D00000; } #wbpBlackKeywordList a.regex, #wbpURLKeywordList a.regex { background-color: #FFB0B0; } #wbpBlackKeywordList a:hover, #wbpURLKeywordList a:hover { border-color: #FF0000; background-color: #FFD0D0; } #wbpGrayKeywordList a { border-color: #808000; color: #808000; } #wbpGrayKeywordList a.regex { background-color: #FFFF00; } #wbpGrayKeywordList a:hover { border-color: #808000; background-color: #FFFFB0; }');
        var keywordBack = $($.create('div')).prop('id', 'wbpSettingsBack').hide();
        var keywordBlock = $($.create('div')).prop({
                                'id' : 'wbpSettings',
                                'className' : 'W_layer'
                            })
                            .html('<div class="bg"><table width="100%" border="0" cellspacing="0" cellpadding="0"><tbody><tr><td><div class="content"><div class="title" node-type="title"><span id="wbpSettingsTitle" node-type="title_content"></span></div><a href="javascript:void(0);" class="W_close" title="关闭" id="wbpCloseBtn"></a><div node-type="inner" class="detail layer_forward" style="width: auto; padding-bottom: 20px;"><div class="clearfix"><div style="float: left;">新浪微博<span style="color: red;">非官方</span>功能增强脚本。</div><div style="float: right; display: inline; position: relative;"><a id="wbpCheckUpdate" href="javascript:void(0);" title="检查脚本是否有新版本">检查更新</a><em class="W_vline" style="margin: 0 8px">|</em><a href="http://userscripts.org/scripts/show/114087" title="新版本在此页面发布" target="_blank">插件主页</a><em class="W_vline" style="margin: 0 8px">|</em><a href="http://code.google.com/p/weibo-content-filter/wiki/FAQ" title="遇到问题请先阅读FAQ" target="_blank">常见问题</a><em class="W_vline" style="margin: 0 8px">|</em><a href="/salviati" title="欢迎私信、评论或@作者提出脚本建议" target="_blank">联系作者</a></div></div><div class="clearfix"><div id="wbpTabHeaders" style="float: left; width: 100px;"><a tab="wbpTabKeywords" href="javascript:void(0);" class="current">关键词</a><a tab="wbpTabLinks" href="javascript:void(0);">链接地址</a><a tab="wbpTabUserSource" href="javascript:void(0);">用户/来源</a><a tab="wbpTabModules" href="javascript:void(0);">版面模块</a><a id="wbpTabHeaderSettings" tab="wbpTabSettings" href="javascript:void(0);">设置导入/导出</a></div><div style="float: right; width: 440px;"><div id="wbpTabKeywords"><input type="checkbox" id="wbpKeywordPaused" style="vertical-align: middle; margin-right: 5px;"><label for="wbpKeywordPaused"><span style="color: red;">暂停屏蔽</span>：选中时暂时解除对关键词的屏蔽</label><div class="wbpKeywordBlock"><em>白名单</em>包含下列关键词的微博不会被屏蔽<table width="100%" border="0" cellspacing="0" cellpadding="0" style="line-height: 30px; margin-top: 8px;"><tbody><tr><td><div class="wbpInput"><input type="text" id="wbpWhiteKeywords" class="input" placeholder="多个关键词用空格隔开；不区分大小写；支持正则表达式"></div></td><td style="width: 120px; text-align: right;"><a href="javascript:void(0);" class="W_btn_a" id="wbpAddWhiteKeyword"><span>添加</span></a><a href="javascript:void(0);" class="W_btn_a" id="wbpClearWhiteKeyword" style="margin-left: 5px;"><span>清空</span></a></td></tr></tbody></table><div id="wbpWhiteKeywordList" class="wbpKeywordList clearfix"></div></div><div class="wbpKeywordBlock"><em>黑名单</em>包含下列关键词的微博将被屏蔽<table width="100%" border="0" cellspacing="0" cellpadding="0" style="line-height: 30px; margin-top: 8px;"><tbody><tr><td><div class="wbpInput"><input type="text" id="wbpBlackKeywords" class="input" placeholder="多个关键词用空格隔开；不区分大小写；支持正则表达式"></div></td><td style="width: 120px; text-align: right;"><a href="javascript:void(0);" class="W_btn_a" id="wbpAddBlackKeyword"><span>添加</span></a><a href="javascript:void(0);" class="W_btn_a" id="wbpClearBlackKeyword" style="margin-left: 5px;"><span>清空</span></a></td></tr></tbody></table><div id="wbpBlackKeywordList" class="wbpKeywordList clearfix"></div></div><div class="wbpKeywordBlock"><em>灰名单</em>包含下列关键词的微博将被屏蔽<span style="color: red;">并提示</span><table width="100%" border="0" cellspacing="0" cellpadding="0" style="line-height: 30px; margin-top: 8px;"><tbody><tr><td><div class="wbpInput"><input type="text" id="wbpGrayKeywords" class="input" placeholder="多个关键词用空格隔开；不区分大小写；支持正则表达式"></div></td><td style="width: 120px; text-align: right;"><a href="javascript:void(0);" class="W_btn_a" id="wbpAddGrayKeyword"><span>添加</span></a><a href="javascript:void(0);" class="W_btn_a" id="wbpClearGrayKeyword" style="margin-left: 5px;"><span>清空</span></a></td></tr></tbody></table><div id="wbpGrayKeywordList" class="wbpKeywordList clearfix"></div><table width="100%" border="0" cellspacing="0" cellpadding="0" style="line-height: 30px;"><tbody><tr><td style="width: 110px;">屏蔽提示背景颜色：</td><td><div class="wbpInput"><input type="text" id="wbpTipBackColor" class="input"></div></td><td style="width: 15px;"></td><td style="width: 110px;">屏蔽提示文字颜色：</td><td><div class="wbpInput"><input type="text" id="wbpTipTextColor" class="input"></div></td></tr></tbody></table><table width="100%" border="0" cellspacing="0" cellpadding="0" style="line-height: 30px; margin-bottom: 8px;"><tbody><tr><td style="width: 40px;">示例：</td><td><div id="wbpTipSample" style="border-style: solid; border-width: 1px; height: 23px; line-height: 23px; text-align: center;">本条来自<a href="javascript:void(0);">@某人</a>的微博因包含关键词“<a href="javascript:void(0);">XXXX</a>”而被隐藏，点击显示</div></td></tr></tbody></table></div></div><div id="wbpTabLinks" style="display: none;"><p>如果一条微博中包含链接且目标地址中包含下列关键词，微博将被屏蔽（无提示）。如将taobao.com设为关键词可屏蔽所有包含淘宝链接的微博。</p><table width="100%" border="0" cellspacing="0" cellpadding="0" style="line-height: 30px; margin-top: 8px;"><tbody><tr><td><div class="wbpInput"><input type="text" id="wbpURLKeywords" class="input" placeholder="多个关键词用空格隔开；不区分大小写；支持正则表达式"></div></td><td style="width: 120px; text-align: right;"><a href="javascript:void(0);" class="W_btn_a" id="wbpAddURLKeyword"><span>添加</span></a><a href="javascript:void(0);" class="W_btn_a" id="wbpClearURLKeyword" style="margin-left: 5px;"><span>清空</span></a></td></tr></tbody></table><div id="wbpURLKeywordList" class="wbpKeywordList"></div><div class="clear"></div></div><div id="wbpTabUserSource" style="display: none;"><p>新浪微博官方已提供针对指定<a href="http://account.weibo.com/set/feed" target="_blank">用户</a>或<a href="http://account.weibo.com/set/feedsource" target="_blank">来源</a>（如“皮皮时光机”）的屏蔽功能，而且在所有浏览器和移动客户端上都有效。但是，如果不开通<a href="http://vip.weibo.com/" target="_blank">微博会员</a>，最多只能屏蔽5个用户，不能屏蔽来源。</p><p style="margin-top: 10px;"><span style="color: red;">您可以使用“眼不见心不烦”的关键词屏蔽功能来免费、无限制地屏蔽用户或来源：</span>要屏蔽某位用户，将其用户名（不要带前面的@）设为屏蔽关键词即可；要屏蔽某种来源，将其名字前加上“来自”并设为屏蔽关键词即可（如“来自皮皮时光机”）。</p></div><div id="wbpTabModules" style="display: none;"><p>请选择要屏蔽的内容。</p><table width="100%" border="0" cellspacing="0" cellpadding="0" style="line-height: 24px; margin-top: 15px;"><tbody><tr><td><input type="checkbox" id="wbpBlockAds"><label for="wbpBlockAds">右边栏/页底广告</label></td><td><input type="checkbox" id="wbpBlockPullyList"><label for="wbpBlockPullyList">微博看点（顶栏广告）</label></td></tr><tr><td><input type="checkbox" id="wbpBlockRecommendedTopic"><label for="wbpBlockRecommendedTopic">推荐微话题</label></td><td><input type="checkbox" id="wbpBlockTasks"><label for="wbpBlockTasks">微博任务（微博宝典）</label></td></tr><tr><td><input type="checkbox" id="wbpBlockMedal"><label for="wbpBlockMedal">勋章</label></td><td><input type="checkbox" id="wbpBlockMood"><label for="wbpBlockMood">心情</label></td></tr><tr><td><input type="checkbox" id="wbpBlockLevel"><label for="wbpBlockLevel">微博等级</label></td><td><input type="checkbox" id="wbpBlockPromotion"><label for="wbpBlockPromotion">微博推广</label></td></tr><tr><td><input type="checkbox" id="wbpBlockMember"><label for="wbpBlockMember">会员专区</label></td><td><input type="checkbox" id="wbpBlockMemberIcon"><label for="wbpBlockMemberIcon">会员专属标识</label></td></tr><tr><td><input type="checkbox" id="wbpBlockVerifyIcon"><label for="wbpBlockVerifyIcon">个人/机构认证（黄/蓝V）</label></td><td><input type="checkbox" id="wbpBlockDarenIcon"><label for="wbpBlockDarenIcon">达人专属标识</label></td></tr><tr><td><input type="checkbox" id="wbpBlockInterestUser"><label for="wbpBlockInterestUser">可能感兴趣的人</label></td><td><input type="checkbox" id="wbpBlockTopic"><label for="wbpBlockTopic">热门话题/关注的话题</label></td></tr><tr><td><input type="checkbox" id="wbpBlockInterestApp"><label for="wbpBlockInterestApp">可能感兴趣的微群/应用/活动</label></td><td><input type="checkbox" id="wbpBlockNotice"><label for="wbpBlockNotice">公告栏</label></td></tr><tr><td><input type="checkbox" id="wbpBlockHelpFeedback"><label for="wbpBlockHelpFeedback">玩转微博/意见反馈</label></td></tr><tr><td><input type="checkbox" id="wbpBlockGame"><label for="wbpBlockGame">游戏（体验版左边栏）</label></td><td><input type="checkbox" id="wbpBlockApp"><label for="wbpBlockApp">应用（体验版左边栏）</label></td></tr></tbody></table><p style="margin-top: 20px;"><a href="javascript:void(0);" class="W_btn_a" id="wbpBlockAll"><span>全选</span></a><a href="javascript:void(0);" class="W_btn_a" style="margin-left: 10px;" id="wbpBlockInvert"><span>反选</span></a></p></div><div id="wbpTabSettings" style="display: none;"><div class="clearfix"><div style="float: left; width: 385px;"><p>当前账号的设置信息在下列文本框中，您可以将其复制到其它位置保存。需要导入设置时，请将设置信息粘贴到文本框中，然后点击“导入”。</p></div><a href="javascript:void(0);" class="W_btn_a" id="wbpImportBtn" style="float: right; margin-top: 6px;"><span>导入</span></a></div><textarea id="wbpSettingsString" rows="10" style="width: 440px; margin-top: 10px; border: 1px solid #D2D5D8;"></textarea></div></div></div><p class="btn"><a href="javascript:void(0);" class="W_btn_b" id="wbpOKBtn"><span>确定</span></a><a href="javascript:void(0);" class="W_btn_a" id="wbpCancelBtn"><span>取消</span></a></p></div></div></td></tr></tbody></table></div>')
                            .cssText('width: 600px; margin-left: -300px; z-index: 10001; position: absolute; display: none;')
                            .hide();
        root.append(keywordBack).append(keywordBlock);
        $('#wbpSettingsTitle').html('“眼不见心不烦”(v' + $version + ')设置');
    },

    showSettingsWindow : function(e) {
        !this.isWindowInitialed && this.loadSettingsWindow();
        $('#wbpSettingsBack').cssText('background-image: initial; background-attachment: initial; background-origin: initial; background-clip: initial; background-color: black; opacity: 0.3; position: fixed; top: 0px; left: 0px; z-index: 10001; width: ' + window.innerWidth + 'px; height: ' + window.innerHeight + 'px;');
        // Chrome与Firefox的scrollLeft, scrollTop储存于不同位置
        $('#wbpSettings').css({
            'left' : (Math.max(0, body.scrollLeft, docElement.scrollLeft) + e.clientX) + 'px',
            'top' : (Math.max(0, body.scrollTop, docElement.scrollTop) + e.clientY + 10) + 'px',
            'display' : ''
        })
    },

    checkUpdate : function() {
        //TODO 简化
        $.ajax({
            method: 'GET',
            // 只载入metadata
            url: 'http://userscripts.org/scripts/source/114087.meta.js',
            onload: function (result) {
                var text = result.responseText;

                if (!text.match(/@version\s+(.*)/)) {return; }
                var ver = RegExp.$1;
                if (!text.match(/@revision\s+(\d+)/) || RegExp.$1 <= $revision) {
                    wbp.stk.ui.alert('脚本已经是最新版。');
                    return;
                }
                var features = '';
                if (text.match(/@features\s+(.*)/)) {
                    features = '- ' + RegExp.$1.split('；').join('\n- ') + '\n\n';
                }
                // 显示更新提示
                wbp.stk.ui.confirm('“眼不见心不烦”新版本v' + ver + '可用。\n\n' + features + '如果您希望更新，请点击“确认”打开脚本页面。', {
                    'OK' : function() {
                        window.open('http://userscripts.org/scripts/show/114087');
                    }
                })
            }
        })
    }
};

wbp.init();
