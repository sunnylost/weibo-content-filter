// ==UserScript==
// @name            眼不见心不烦1.0（新浪微博）
// @namespace       http://weibo.com/salviati
// @license         MIT License
// @description     在新浪微博（weibo.com）中隐藏包含指定关键词的微博。
// @features        增加对个人/机构认证（黄/蓝V）及微博达人标识的屏蔽
// @version         1.0a
// @revision        50
// @author          @富平侯(/salviati)
// @thanksto        @牛肉火箭(/sunnylost)；@JoyerHuang_悦(/collger)
// @include         http://weibo.com/*
// @include         http://www.weibo.com/*
// @exclude         http://www.weibo.com/*/*
// ==/UserScript==

//Firefox安装GreaseMonkey扩展
//Chrome原生支持，但也可以选择安装Tampermonkey
//IE暂时不予考虑
//Safari安装GreaseScript。http://hi.hiing.net/2009/01/greasemonkey-scripts-in-safari.html  未验证
//Opera http://my.opera.com/Contrid/blog/2007/02/11/how-to-greasemonkey-in-opera

/**
 * $工具对象
 * wbp对象，命名空间
 *  --wbp.Filter  过滤
 *  --wbp.Feed    微博
 *  --wbp.Module  模块
 *  --wbp.Window  设置窗口
 *  --wbp.Config  设置对象
 *
 *
 * TODO： 对象设计合理化
 *        跨浏览器
 *
 *        兼容过去的设置
 *
 *
 */
try {
    var beginTime = new Date();
    var doc = document;
    var head = doc.head;
    var body = doc.body;
    var docElement = doc.documentElement;

    var $version = 1;
    var $revision = 50;

    var $ = (function() {
        var cached = {};
        var guid = 0;
        var scriptPrefix = 'wbpscript';
        var ArrayProto = Array.prototype;
        var push = ArrayProto.push;
        var concat = ArrayProto.concat;
        var stk; //weibo框架
        var root;
        var rtrim = /^\s+|\s+$/g;

        var $ = function(selector, context) {
            return new $.prototype.init(selector, context);
        };

        //static method
        $.find = function(selector, context) {
            return (context || doc).querySelectorAll(selector);
        };

        $.create = function(tag) { //create element, with cache
            var el = cached[tag] || (cached[tag] = doc.createElement(tag));
            return $(el.cloneNode(false));
        };

        $.createText = function(content) {
            return doc.createTextNode(content);
        }

        $.trim = String.prototype.trim ? function(s) {
            return s != null ? s.trim() : '';
        } : function(s) {
            return s != null ? (s.replace(rtrim, '')) : '';
        };

        var keyRoot = 'weiboPlus.';
        if (!GM_getValue || (GM_getValue.toString && GM_getValue.toString().indexOf("not supported")>-1)) {
            $.get = function(name, defaultValue) {
                return localStorage.getItem(keyRoot + name) || defaultValue;
            };

            $.save = function(name, value) {
                localStorage.setItem(keyRoot + name, value);
                return this;
            };

            $.remove = function(name) {
                localStorage.removeItem(keyRoot + name);
                return this;
            }
        } else {
            $.get = function(name, defaultValue) {
                return GM_getValue(keyRoot + name, defaultValue);
            };

            $.save = function(name, value) {
                GM_setValue(keyRoot + name, value);
                return this;
            };

            $.remove = function(name) {
                GM_deleteValue(keyRoot + name);
                return this;
            }
        }

        $.addStyle = function() {
            if(GM_addStyle) {
                return function(css) {
                    GM_addStyle(css)
                    return this
                }
            } else {
                return function(css) {
                    $.create('style').prop({
                        'type' : 'text/style'
                    }).insert(head).html(css)
                    return this
                }
            }
        }();

        //简单模板，类似#T{abc}
        $.template = function(str, obj) {
            str = str.replace(new RegExp('#T{([^}]*?)}', 'g'), function(m, m1) {
                return obj[m1]
            })
            return str
        };

        //AJAX  不做过多考虑，只做基于GET的请求
        $.ajax = function(config) {
            if(GM_xmlhttpRequest) {
                $.ajax = function(config) {
                    GM_xmlhttpRequest(config)
                    return this
                }
            } else {
                $.ajax = function(config) {
                    var xhr = new XMLHttpRequest()
                    xhr.onreadystatechange = function() {
                        if(xhr.readyState == 4) {
                            if((xhr.status >= 200 && xhr.status < 300) || xhr == 304) {
                                config.onload();
                            }
                        }
                    }
                    xhr.open('get', config.url, true)
                    xhr.send(null)
                    return this
                }
            }
            $.ajax(config)
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

        $.merge = function(first, second) {
            var i = first.length,
                j = 0;

            if ( typeof second.length === "number" ) {
                for ( var l = second.length; j < l; j++ ) {
                    first[ i++ ] = second[ j ];
                }

            } else {
                while ( second[j] !== undefined ) {
                    first[ i++ ] = second[ j++ ];
                }
            }
            first.length = i;
            return first;
        };

        //instance method
        $.prototype = {
            constructor : $,

            init : function(selector, context) {
                context = context || body;
                //console.log('-----BEGIN-----')
                //console.log(selector);
                var type = typeof selector;
                var arr = [];
                if(type == 'object' && selector.length) {
                    $.each(selector, function(n, v) {
                        var o = (typeof v == 'string' ? doc.querySelectorAll(selector, context) : [v])
                        arr = concat.call(o, arr);
                    })
                    this.context = context;
                    this.previouseObj = this;
                    $.merge(this, arr);
                    return this;
                } else if(type == 'string') {
                    selector = doc.querySelectorAll(selector, context);
                } else {
                    selector = [selector == null ? body : selector]
                }
                //console.log(selector);
                //console.log('-----END-----')
                this.context = context;
                this.previouseObj = this;
                push.apply(this, selector);
            },

            length : 0,

            eq : function(index) {
                index = +index;
                var sub = index  < 0 ? $(this[this.length + index]) : $(this[index]);
                sub.previousObj = this;
                return sub;
            },

            back : function() {
                return this.previousObj;
            },

            find : function(selector) {  //查找第一个元素的子元素
                var sub = $(selector, this[0]);
                sub.previousObj = this;
                return sub;
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
                    this[0].style[name] = value;
                }
                return this;
            },

            addClassName : function(name) {
                var rclassname = new RegExp('\\b' + name + '\\b', 'g');
                $.each(this, function() {
                    !$(this).hasClassName(name) && (this.className += ' ' + name);
                })
                return this;
            },

            hasClassName : function(name) {
                return new RegExp('\\b' + name + '\\b').test(this[0].className);
            },

            removeClassName : function(name) {
                $.each(this, function() {
                    var className = this.className;
                    $(this).hasClassName(name) && (this.className = className.replace(new RegExp('\\b' + name + '\\b'), ''))
                })
                return this;
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

            val : function(value) {
                if(typeof value == 'undefined') {
                    return this.length && this[0].value;
                } else {
                    $.each(this, function() {
                        this.value = value;
                    })
                    return this;
                }
            },

            //DOM
            children : function(index) {
                var children = this[0].children;
                var len = children.length;
                index = index > len ? (index < 0 ? (len + index) : index) : index;
                return $(children[index]);
            },

            parent : function() {
                var parent = $(this[0].parentNode);
                parent.previousObj = this;
                return parent;
            },

            next : doc.head.nextElementSibling ? function() {
                var next = $(this[0].nextElementSibling);
                next.previousObj = this;
                return next;
            } : function() {
                var next = this[0];
                do {
                    next = next.nextSibling;
                } while(next && next.nodeType != 1)
                next = $(next);
                next.previousObj = this;
                return next;
            },

            append : function(child) {
                child = child.length && child.constructor == $ ? child[0] : child; //只操作第一个元素
                this[0].appendChild(child);
                return this;
            },

            insert : function(el) { //相当于el.appendChild
                el && (el.nodeType ? el : el[0]).appendChild(this[0]);
                return this;
            },

            insertAfter : function(el) {
                el && (el.nodeType ? el : el[0]).parentNode.insertBefore(this[0], $(el).next()[0]);
                return this;
            },

            insertBefore : function(el) {
                if(!el) return this;
                el = el.length ? el[0] : el;
                el.parentNode.insertBefore(this[0], el);
                return this;
            },

            //移除节点
            remove : function() {
                $.each(this, function() {
                    this.parentNode.removeChild(this);
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
                    var tagName = this.tagName.toLowerCase(); //V标志位img标签，设置block会占据一行
                    this.style.display = tagName == 'img' ? '' : 'block';
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

            pos : function() {
                return this[0].getBoundingClientRect();
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
            //包含action-type的节点会触发事件函数
            delegate : function(type, fn) {
                this.on(type, function(e) {
                    var target = e.target;
                    var data;
                    while(target && target.nodeType == 1) {
                        e.actionType = target.getAttribute('action-type') || target['action-type'];
                        e.data = {};
                        data = target.getAttribute('action-data') || target['action-data'];
                        data && $.each(data.split('&'), function(i, v) {
                            var map = v.split('=');
                            e.data[map[0]] = map[1];
                        });
                        e.actionType && fn.call(target, e);
                        target = target.parentNode;
                    }
                })
                return this;
            }
        };

        $.prototype.init.prototype = $.prototype;

        // TODO
        (function() {
            var global = window || unsafeWindow;
            if (unsafeWindow) {
                // 非Chrome浏览器，优先使用unsafeWindow获取全局变量
                // 由于varname中可能包括'.'，因此使用eval()获取变量值
                $.global = function (name) {
                    return eval('unsafeWindow.' + name);
                };
            } else if(window) {
                $.global = function (name) {
                    return eval('window.' + name);
                };
            } else {
                // Chrome原生不支持unsafeWindow，脚本运行在沙箱中，因此不能访问全局变量。
                // 但用户脚本与页面共享DOM，所以可以设法将脚本注入host页
                // 详见http://voodooattack.blogspot.com/2010/01/writing-google-chrome-extension-how-to.html
                $.global = function (varname) {
                    // 生成脚本
                    var elem = $.create('script');
                    elem.prop({
                        id : scriptPrefix + (guid++),
                        type : 'text/javascript'
                    }).html('(function(){document.getElementById("' + elem.id + '").innerText=' + varname + '; }());');
                    $(doc.head).append(elem);
                    // 获取返回值
                    var ret = elem.html();
                    elem.remove();
                    elem = null;
                    return ret;
                };
            }
        })()
        //UI

        $.alert = function(text) {
            stk = $.global('STK');
            if(!stk || !stk.ui) {
                $.alert = function(text) {
                    alert(text.replace(/\<br(\/)?\>/g, '\n').replace(/\<(\/)?b?\>/g, ''));
                };
            } else {
                $.alert = stk.ui.alert;
            }
            $.alert(text);
        };
        $.confirm = function(text, config) {
            stk = $.global('STK');
            if(!stk || !stk.ui) {
                $.confirm = function(text, config) {
                    if(confirm(text.replace(/\<br(\/)?\>/g, '\n').replace(/\<(\/)?b\>/g, ''))) {
                        config && typeof config.OK == 'function' && config.OK();
                    }
                };
            } else {
                $.confirm = stk.ui.confirm;
            }
            $.confirm(text, config);
        };
        return $;
    }())

    var config = null;
    var $uid = '';
    var attempTimes = 5;

    var wbp = {
        scope : function() {
            return this.scopeVal || (this.scopeVal = config['pageid'] == 'content_home' ? 1 : config['pageid'] == 'content_hisWeibo' ? 2 : -1);
        },

        init : function() {
            config = $.global('$CONFIG');
            if(!config && attempTimes) {
                attempTimes -= 1;
                setTimeout(wbp.init.bind(wbp), 30);
            } else {
                $uid = config['uid'];
                if(this.scope() < 0) return;
                this.Config.init();
                this.Window.showSettingsBtn(); //显示按钮
                wbp.pauseFilter = wbp.Config.get('keywordPaused');  //是否暂停过滤
                if(!wbp.pauseFilter && $.find('.feed_lists').length > 0) {
                    wbp.Filter.filterFeeds();
                }
                $(doc).on('DOMNodeInserted', this.handleInsert);
                this.Module.operate();  //屏蔽模块
                console.log('启动时间=' + (new Date - beginTime) + 'ms');
            }
        },

        handleInsert : function(e) { //处理动态载入节点
            if(wbp.pauseFilter) return true;
            var target = e.target;
            var tagName = target.tagName;
            var classList = target.classList;
            if(tagName == 'DL' && classList.contains('feed_list')) {
                return wbp.Filter.filterFeed(new wbp.Feed(target));
            } else if(tagName === 'DIV' && classList.contains('feed_lists')) {
                return wbp.Filter.filterFeeds();
            }
        }
    };

    wbp.Config = function() {
        var config = null;

        var init = function() {
            var str = $.get($uid, '');
            config = !str ? {
                keywordPaused : false,
                whiteKeywords : {},
                blackKeywords : {},
                grayKeywords : {},
                URLKeywords : {},
                tipBackColor : '#FFD0D0',
                tipTextColor : '#FF8080',
                hideBlock : {}
            } : JSON.parse(str);
        };

        var getConfig = function(name) {
            return name ? config[name] : config;
        };

        var getConfigInStringFormat = function() { //返回控制对象的字符串形式
            return JSON.stringify(config);
        };

        var saveConfig = function(o) {
            o = o || config;
            var type = typeof o;
            if(type == 'string') {
                try {
                    JSON.parse(o.replace(/\n/g, ''));
                    $.save($uid, o);
                } catch(e){
                    return false;
                }
            } else if(o != null && type == 'object') {
                $.save($uid, JSON.stringify(o));
            }
            return true;
        };

        return {
            init : init,
            get : getConfig,
            getString : getConfigInStringFormat,
            save : saveConfig
        }
    }();

    wbp.Module = {
        modules : {// 模块屏蔽设置
            'Topic' : '#pl_content_promotetopic, #trustPagelete_zt_hottopic',
            'InterestUser' : '#pl_content_homeInterest, #trustPagelete_recom_interest',
            'InterestApp' : '#pl_content_allInOne, #trustPagelete_recom_allinone',
            'Notice' : '#pl_common_noticeboard, #pl_rightmod_noticeboard',
            'HelpFeedback' : '#pl_common_help, #pl_common_feedback, #pl_rightmod_help, #pl_rightmod_feedback, #pl_rightmod_tipstitle',
            'Ads' : '#plc_main .W_main_r div[id^="ads_"], div[ad-data], #ads_bottom_1',
            'PullyList' : '#pl_content_pullylist, #pl_content_biztips',
            'RecommendedTopic' : '#pl_content_publisherTop div[node-type="recommendTopic"]',
            'Mood' : '#pl_content_mood',
            'Medal' : '#pl_content_medal, #pl_rightmod_medal, .declist',
            'Game' : '#pl_leftNav_game',
            'App' : '#pl_leftNav_app',
            'Tasks' : '#pl_content_tasks',
            'Promotion' : '#pl_rightmod_promotion, #trustPagelet_ugrowth_invite',
            'Level' : '#pl_content_personInfo p.level, #pl_leftNav_common dd.nameBox p, #pl_content_hisPersonalInfo span.W_level_ico',
            'Member' : '#trustPagelet_recom_member',
            'MemberIcon' : '.ico_member',
            'VerifyIcon' : '.approve, .approve_co',
            'DarenIcon' : '.ico_club'
        },

        operate : function() {
            var allModules = wbp.Config.get('hideBlock');
            var modules = this.modules;
            var styles = [];
            var hideStr = '{display:none; visibility: hidden;}';
            $.each(allModules, function(name, value) {
                value && styles.push(modules[name] + hideStr);
            })

            var styleObj = $('#wbpBlockStyles');
            if(!styleObj.length) {
                styleObj = $.create('style').prop({
                    type : 'text/css',
                    id : 'wbpBlockStyles'
                }).insert(head);
            }
            styleObj.html(styles.join(''));
        }
    };

    wbp.Window = {
        isWindowInitialed : false, //窗口初始化

        const : {  //静态变量
            'btn' : '<span><em><a id="wbpShowSettings" href="javascript:void(0)">眼不见心不烦</a></em></span>',

            'back' : 'background-image: initial; background-attachment: initial; background-origin: initial; background-clip: initial; background-color: black; opacity: 0.3; position: fixed; top: 0px; left: 0px; z-index: 10001; width:#T{width}px; height:#T{height}px;',

            'windowStyle' : '#wbpSettings p { line-height: 150%; } #wbpTabHeaders a { display: block; padding: 6px 0; text-align: center; text-decoration: none; } #wbpTabHeaders a:hover { background-color: #C6E8F4; } #wbpTabHeaders a.current { background-color: #79C5E9; color: white; cursor: default; } #wbpSettings .wbpInput { border: 1px solid #D2D5D8; padding: 0 2px; } #wbpSettings .wbpInput input { width: 100%; height: 22px; border: 0; padding: 0; margin: 0; display: block; } #wbpSettings .detail > div { margin-top: 15px; } #wbpTabModules input { vertical-align: middle; margin-right: 5px; } #wbpSettings .wbpKeywordBlock { margin-top: 10px; border: 1px solid #D2D5D8; padding: 8px 8px 0; } #wbpSettings .wbpKeywordBlock em { font-weight: bold; margin-right: 15px; } #wbpSettings .wbpKeywordList { margin-top: 8px; overflow: hidden; } #wbpSettings .wbpKeywordList a { margin: 0 5px 8px 0; padding: 0 4px; border: 1px solid; float: left; height: 18px; line-height: 18px; white-space: nowrap; } #wbpSettings .wbpKeywordList a:hover { text-decoration: none; } #wbpWhiteKeywordList a { border-color: #008000; color: #008000; } #wbpWhiteKeywordList a.regex { background-color: #80FF80; } #wbpWhiteKeywordList a:hover { border-color: #008000; background-color: #D0FFD0; } #wbpBlackKeywordList a, #wbpURLKeywordList a { border-color: #D00000; color: #D00000; } #wbpBlackKeywordList a.regex, #wbpURLKeywordList a.regex { background-color: #FFB0B0; } #wbpBlackKeywordList a:hover, #wbpURLKeywordList a:hover { border-color: #FF0000; background-color: #FFD0D0; } #wbpGrayKeywordList a { border-color: #808000; color: #808000; } #wbpGrayKeywordList a.regex { background-color: #FFFF00; } #wbpGrayKeywordList a:hover { border-color: #808000; background-color: #FFFFB0; }',

            'windowHtml' : '<div class="bg"><table width="100%" border="0" cellspacing="0" cellpadding="0"><tbody><tr><td><div class="content"><div class="title" node-type="title"><span id="wbpSettingsTitle" node-type="title_content"></span></div><a href="javascript:void(0);" class="W_close" title="关闭" action-type="closeWindow"></a><div node-type="inner" class="detail layer_forward" style="width: auto; padding-bottom: 20px;"><div class="clearfix"><div style="float: left;">新浪微博<span style="color: red;">非官方</span>功能增强脚本。</div><div style="float: right; display: inline; position: relative;"><a action-type="checkUpdate" href="javascript:void(0);" title="检查脚本是否有新版本">检查更新</a><em class="W_vline" style="margin: 0 8px">|</em><a href="http://userscripts.org/scripts/show/114087" title="新版本在此页面发布" target="_blank">插件主页</a><em class="W_vline" style="margin: 0 8px">|</em><a href="http://code.google.com/p/weibo-content-filter/wiki/FAQ" title="遇到问题请先阅读FAQ" target="_blank">常见问题</a><em class="W_vline" style="margin: 0 8px">|</em><a href="/salviati" title="欢迎私信、评论或@作者提出脚本建议" target="_blank">联系作者</a></div></div><div class="clearfix"><div id="wbpTabHeaders" style="float: left; width: 100px;"><a action-type="changeTab" action-data="index=0&name=wbpTabKeywords" href="javascript:void(0);" class="current">关键词</a><a action-type="changeTab" action-data="index=1&name=wbpTabLinks" href="javascript:void(0);">链接地址</a><a action-type="changeTab" action-data="index=2&name=wbpTabUserSource" href="javascript:void(0);">用户/来源</a><a action-type="changeTab" action-data="index=3&name=wbpTabModules" href="javascript:void(0);">版面模块</a><a action-type="changeTab" action-data="index=4&name=wbpTabSettings" href="javascript:void(0);">设置导入/导出</a></div><div id="wbpTabContents" style="float: right; width: 440px;"><div id="wbpTabKeywords"><input type="checkbox" id="wbpKeywordPaused" style="vertical-align: middle; margin-right: 5px;"><label for="wbpKeywordPaused"><span style="color: red;">暂停屏蔽</span>：选中时暂时解除对关键词的屏蔽</label><div class="wbpKeywordBlock"><em>白名单</em>包含下列关键词的微博不会被屏蔽<table width="100%" border="0" cellspacing="0" cellpadding="0" style="line-height: 30px; margin-top: 8px;"><tbody><tr><td><div class="wbpInput"><input type="text" id="wbpWhiteKeywords" class="input" placeholder="多个关键词用空格隔开；不区分大小写；支持正则表达式"></div></td><td style="width: 120px; text-align: right;"><a href="javascript:void(0);" class="W_btn_a" action-type="addKeyWord" action-data="id=wbpWhiteKeywords&list=wbpWhiteKeywordList&type=whiteKeywords"><span>添加</span></a><a href="javascript:void(0);" class="W_btn_a" action-type="clearKeyWord" action-data="type=whiteKeywords&list=wbpWhiteKeywordList" style="margin-left: 5px;"><span>清空</span></a></td></tr></tbody></table><div id="wbpWhiteKeywordList" class="wbpKeywordList clearfix"></div></div><div class="wbpKeywordBlock"><em>黑名单</em>包含下列关键词的微博将被屏蔽<table width="100%" border="0" cellspacing="0" cellpadding="0" style="line-height: 30px; margin-top: 8px;"><tbody><tr><td><div class="wbpInput"><input type="text" id="wbpBlackKeywords" class="input" placeholder="多个关键词用空格隔开；不区分大小写；支持正则表达式"></div></td><td style="width: 120px; text-align: right;"><a href="javascript:void(0);" class="W_btn_a" action-type="addKeyWord" action-data="id=wbpBlackKeywords&list=wbpBlackKeywordList&type=blackKeywords"><span>添加</span></a><a href="javascript:void(0);" class="W_btn_a" action-type="clearKeyWord" action-data="type=blackKeywords&list=wbpBlackKeywordList" style="margin-left: 5px;"><span>清空</span></a></td></tr></tbody></table><div id="wbpBlackKeywordList" class="wbpKeywordList clearfix"></div></div><div class="wbpKeywordBlock"><em>灰名单</em>包含下列关键词的微博将被屏蔽<span style="color: red;">并提示</span><table width="100%" border="0" cellspacing="0" cellpadding="0" style="line-height: 30px; margin-top: 8px;"><tbody><tr><td><div class="wbpInput"><input type="text" id="wbpGrayKeywords" class="input" placeholder="多个关键词用空格隔开；不区分大小写；支持正则表达式"></div></td><td style="width: 120px; text-align: right;"><a href="javascript:void(0);" class="W_btn_a" action-type="addKeyWord" action-data="id=wbpGrayKeywords&list=wbpGrayKeywordList&type=grayKeywords"><span>添加</span></a><a href="javascript:void(0);" class="W_btn_a" action-type="clearKeyWord" action-data="list=wbpGrayKeywordList&type=grayKeywords" style="margin-left: 5px;"><span>清空</span></a></td></tr></tbody></table><div id="wbpGrayKeywordList" class="wbpKeywordList clearfix"></div><table width="100%" border="0" cellspacing="0" cellpadding="0" style="line-height: 30px;"><tbody><tr><td style="width: 110px;">屏蔽提示背景颜色：</td><td><div class="wbpInput"><input type="text" id="wbpTipBackColor" class="input"></div></td><td style="width: 15px;"></td><td style="width: 110px;">屏蔽提示文字颜色：</td><td><div class="wbpInput"><input type="text" id="wbpTipTextColor" class="input"></div></td></tr></tbody></table><table width="100%" border="0" cellspacing="0" cellpadding="0" style="line-height: 30px; margin-bottom: 8px;"><tbody><tr><td style="width: 40px;">示例：</td><td><div id="wbpTipSample" style="border-style: solid; border-width: 1px; height: 23px; line-height: 23px; text-align: center;">本条来自<a href="javascript:void(0);">@某人</a>的微博因包含关键词“<a href="javascript:void(0);">XXXX</a>”而被隐藏，点击显示</div></td></tr></tbody></table></div></div><div id="wbpTabLinks" style="display: none;"><p>如果一条微博中包含链接且目标地址中包含下列关键词，微博将被屏蔽（无提示）。如将taobao.com设为关键词可屏蔽所有包含淘宝链接的微博。</p><table width="100%" border="0" cellspacing="0" cellpadding="0" style="line-height: 30px; margin-top: 8px;"><tbody><tr><td><div class="wbpInput"><input type="text" id="wbpURLKeywords" class="input" placeholder="多个关键词用空格隔开；不区分大小写；支持正则表达式"></div></td><td style="width: 120px; text-align: right;"><a href="javascript:void(0);" class="W_btn_a" action-type="addKeyWord" action-data="id=wbpURLKeywords&list=wbpURLKeywordList&type=URLKeywords"><span>添加</span></a><a href="javascript:void(0);" class="W_btn_a" action-type="clearKeyWord" action-data="type=URLKeywords&list=wbpURLKeywordList" style="margin-left: 5px;"><span>清空</span></a></td></tr></tbody></table><div id="wbpURLKeywordList" class="wbpKeywordList"></div><div class="clear"></div></div><div id="wbpTabUserSource" style="display: none;"><p>新浪微博官方已提供针对指定<a href="http://account.weibo.com/set/feed" target="_blank">用户</a>或<a href="http://account.weibo.com/set/feedsource" target="_blank">来源</a>（如“皮皮时光机”）的屏蔽功能，而且在所有浏览器和移动客户端上都有效。但是，如果不开通<a href="http://vip.weibo.com/" target="_blank">微博会员</a>，最多只能屏蔽5个用户，不能屏蔽来源。</p><p style="margin-top: 10px;"><span style="color: red;">您可以使用“眼不见心不烦”的关键词屏蔽功能来免费、无限制地屏蔽用户或来源：</span>要屏蔽某位用户，将其用户名（不要带前面的@）设为屏蔽关键词即可；要屏蔽某种来源，将其名字前加上“来自”并设为屏蔽关键词即可（如“来自皮皮时光机”）。</p></div><div id="wbpTabModules" style="display: none;"><p>请选择要屏蔽的内容。</p><table width="100%" border="0" cellspacing="0" cellpadding="0" style="line-height: 24px; margin-top: 15px;"><tbody><tr><td><input type="checkbox" id="wbpBlockAds"><label for="wbpBlockAds">右边栏/页底广告</label></td><td><input type="checkbox" id="wbpBlockPullyList"><label for="wbpBlockPullyList">微博看点（顶栏广告）</label></td></tr><tr><td><input type="checkbox" id="wbpBlockRecommendedTopic"><label for="wbpBlockRecommendedTopic">推荐微话题</label></td><td><input type="checkbox" id="wbpBlockTasks"><label for="wbpBlockTasks">微博任务（微博宝典）</label></td></tr><tr><td><input type="checkbox" id="wbpBlockMedal"><label for="wbpBlockMedal">勋章</label></td><td><input type="checkbox" id="wbpBlockMood"><label for="wbpBlockMood">心情</label></td></tr><tr><td><input type="checkbox" id="wbpBlockLevel"><label for="wbpBlockLevel">微博等级</label></td><td><input type="checkbox" id="wbpBlockPromotion"><label for="wbpBlockPromotion">微博推广</label></td></tr><tr><td><input type="checkbox" id="wbpBlockMember"><label for="wbpBlockMember">会员专区</label></td><td><input type="checkbox" id="wbpBlockMemberIcon"><label for="wbpBlockMemberIcon">会员专属标识</label></td></tr><tr><td><input type="checkbox" id="wbpBlockVerifyIcon"><label for="wbpBlockVerifyIcon">个人/机构认证（黄/蓝V）</label></td><td><input type="checkbox" id="wbpBlockDarenIcon"><label for="wbpBlockDarenIcon">达人专属标识</label></td></tr><tr><td><input type="checkbox" id="wbpBlockInterestUser"><label for="wbpBlockInterestUser">可能感兴趣的人</label></td><td><input type="checkbox" id="wbpBlockTopic"><label for="wbpBlockTopic">热门话题/关注的话题</label></td></tr><tr><td><input type="checkbox" id="wbpBlockInterestApp"><label for="wbpBlockInterestApp">可能感兴趣的微群/应用/活动</label></td><td><input type="checkbox" id="wbpBlockNotice"><label for="wbpBlockNotice">公告栏</label></td></tr><tr><td><input type="checkbox" id="wbpBlockHelpFeedback"><label for="wbpBlockHelpFeedback">玩转微博/意见反馈</label></td></tr><tr><td><input type="checkbox" id="wbpBlockGame"><label for="wbpBlockGame">游戏（体验版左边栏）</label></td><td><input type="checkbox" id="wbpBlockApp"><label for="wbpBlockApp">应用（体验版左边栏）</label></td></tr></tbody></table><p style="margin-top: 20px;"><a href="javascript:void(0);" class="W_btn_a" action-type="blockAll"><span>全选</span></a><a href="javascript:void(0);" class="W_btn_a" style="margin-left: 10px;" action-type="blockInvert"><span>反选</span></a></p></div><div id="wbpTabSettings" style="display: none;"><div class="clearfix"><div style="float: left; width: 385px;"><p>当前账号的设置信息在下列文本框中，您可以将其复制到其它位置保存。需要导入设置时，请将设置信息粘贴到文本框中，然后点击“导入”。</p></div><a href="javascript:void(0);" class="W_btn_a" action-type="importSettings" style="float: right; margin-top: 6px;"><span>导入</span></a></div><textarea id="wbpSettingsString" rows="10" style="width: 440px; margin-top: 10px; border: 1px solid #D2D5D8;"></textarea></div></div></div><p class="btn"><a href="javascript:void(0);" class="W_btn_b" action-type="applySettings"><span>确定</span></a><a href="javascript:void(0);" class="W_btn_a" action-type="closeWindow"><span>取消</span></a></p></div></div></td></tr></tbody></table></div>'
        },

        showSettingsBtn : function() {
            var that = this;
            var groups = $('#pl_content_homeFeed .nfTagB, #pl_content_hisFeed .nfTagB');
            // Firefox的div#pl_content_homeFeed载入时是空的，此时无法置入页面，稍后由onDOMNodeInsertion()处理
            if (groups.length == 0) {
                setTimeout(this.showSettingsBtn.bind(this), 10);
                return;
            }
            groups.children(0).append($.create('li').html(this.const['btn']));
            (this.settingsBtn = $('#wbpShowSettings')).click(function(e) {
                that.show(e);
            });
            return true;
        },
        //初始化窗口
        loadSettingsWindow : function() {
            if (this.isWindowInitialed) {return true; }
            this.isWindowInitialed = true;
            // 加入选项设置
            $.addStyle(this.const['windowStyle']);
            var keywordBack = $.create('div').prop('id', 'wbpSettingsBack').hide();
            var keywordBlock = $.create('div').prop({
                'id' : 'wbpSettings',
                'className' : 'W_layer'
            })
                .html(this.const['windowHtml'])
                .cssText('width: 600px; margin-left: -150px; z-index: 10001; position: absolute; display: none;')
                .hide();
            $(body).append(keywordBack).append(keywordBlock);
            this.mask = keywordBack;
            this.window = keywordBlock;
            this.tabs = $('#wbpTabHeaders a');
            this.contents = this.tabs.parent().next().find('#wbpTabContents > div');
            this.previousIndex = 0;  //默认选中第一项
            //绑定事件
            var that = this;
            keywordBlock.delegate('click', function(e) {
                that.eventHandlers[e.actionType].call(that, e);
            });
            var contents = this.contents;
            var config = wbp.Config.get();
            var modules = config.hideBlock;
            //初始化内容
            $('#wbpSettingsTitle').html('“眼不见心不烦”(v' + $version + ')设置');
            $('#wbpKeywordPaused').prop('checked', wbp.Config.get('keywordPaused'))// 暂停屏蔽

            var keywordArr = [];
            var keywordPrefix = '<a href="javascript:void(0)" title="删除关键词" action-type="deleteKeyWord" action-data=';
            var keywordEnd = '</a>';
            //TODO 0.8的对象结构和1.0不同，例如whiteKeywords在0.8为数组，在1.0则为对象，这里需要区分对待
            var whiteKeywords = config.whiteKeywords;
            if(whiteKeywords != '') {//初始化白名单
                if(typeof whiteKeywords == 'array') {
                    $.each(whiteKeywords, function(n, v) {
                        keywordArr.push(keywordPrefix + '"type=whiteKeywords">' + v + keywordEnd);
                    })
                } else {
                    $.each(whiteKeywords, function(n, v) {
                        keywordArr.push(keywordPrefix + '"type=whiteKeywords">' + n + keywordEnd);
                    })
                }
                $('#wbpWhiteKeywordList').html(keywordArr.join(''));
            }
            keywordArr.length = 0;

            //初始化黑名单
            var blackKeywords = config.blackKeywords;
            if(blackKeywords != '') {
                if(typeof blackKeywords == 'array') {
                    $.each(blackKeywords, function(n, v) {
                        keywordArr.push(keywordPrefix + '"type=blackKeywords">' + v + keywordEnd);
                    })
                } else {
                    $.each(blackKeywords, function(n, v) {
                        keywordArr.push(keywordPrefix + '"type=blackKeywords">' + n + keywordEnd);
                    })
                }
                $('#wbpBlackKeywordList').html(keywordArr.join(''));
            }
            keywordArr.length = 0;
            //初始化灰名单
            var grayKeywords = config.grayKeywords;
            if(grayKeywords != '') {
                if(typeof grayKeywords == 'array') {
                    $.each(grayKeywords, function(n, v) {
                        keywordArr.push(keywordPrefix + '"type=grayKeywords">' + v + keywordEnd);
                    })
                } else {
                    $.each(grayKeywords, function(n, v) {
                        keywordArr.push(keywordPrefix + '"type=grayKeywords">' + n + keywordEnd);
                    })
                }
                $('#wbpGrayKeywordList').html(keywordArr.join(''));
            }
            keywordArr.length = 0;

            var tipBackColor = config.tipBackColor;
            var tipTextColor = config.tipTextColor;
            $('#wbpTipBackColor').val(tipBackColor).on('blur', this.eventHandlers.changeTipBackgroundColor);
            $('#wbpTipTextColor').val(tipTextColor).on('blur', this.eventHandlers.changeTipTextColor);
            wbp.Window.sample = $('#wbpTipSample').css({
                'backgroundColor' : tipBackColor,
                'borderColor' : tipTextColor,
                'color' : tipTextColor
            })

            var urlKeywords = config.URLKeywords;
            if(urlKeywords != '') {
                if(typeof urlKeywords == 'array') {
                    $.each(urlKeywords, function(n, v) {
                        keywordArr.push(keywordPrefix + '"type=URLKeywords">' + v + keywordEnd);
                    })
                } else {
                    $.each(urlKeywords, function(n, v) {
                        keywordArr.push(keywordPrefix + '"type=URLKeywords">' + n + keywordEnd);
                    })
                }
                $('#wbpURLKeywordList').html(keywordArr.join(''));
            }
            keywordArr = null;

            //第三个栏目内容是版面模块，从0开始计算栏目数
            $.each(contents.eq(3).find('[type=checkbox]'), function() {
                this.checked = modules[this.id.replace('wbpBlock', '')];
            })
            contents.eq(4).find('#wbpSettingsString').html(wbp.Config.getString()); //导入导出设置
        },
        //显示窗口
        show : function(e) {
            !this.isWindowInitialed && this.loadSettingsWindow();
            this.mask.cssText($.template(this.const['back'], {
                'height' : window.innerHeight,
                'width' : window.innerWidth
            })).show();
            // Chrome与Firefox的scrollLeft, scrollTop储存于不同位置
            var pos = e ? {left:e.clientX, top:e.clientY} : this.settingsBtn.pos();
            $('#wbpSettings').css({
                'left' : (Math.max(0, body.scrollLeft, docElement.scrollLeft) + pos.left) + 'px',
                'top' : (Math.max(0, body.scrollTop, docElement.scrollTop) + pos.top - 50) + 'px',
                'display' : ''
            })
        },

        hide : function() {
            this.mask.hide();
            this.window.hide();
        },

        eventHandlers : {
            'addKeyWord' : function(e) {
                var data = e.data;
                var type = data.type;
                var input = $('#' + data.id);
                var list = $('#' + data.list);
                var keywords = $.trim(input.val()).split(' ');
                var len = keywords.length;

                //增加关键字
                var config = wbp.Config.get();
                if(typeof config[type] == 'string') {
                    config[type] = {};
                }

                for(var i = 0; i<len; i++) {
                    var keyword = keywords[i];
                    var klen = keyword.length;
                    if(klen > 0 && !config[type][keyword]) {
                        //判断是否为正则表达式
                        if(klen > 2 && keyword.charAt(0) === '/' && keyword.charAt(klen - 1) === '/') {
                            try {
                                var reg = keyword.substring(1, klen - 1);
                                RegExp(reg).test('');
                                config[type][keyword] = reg;
                            } catch(e) {
                                $.alert('该正则表达式 <b>' + keyword + '</b> 无效！');
                                return true;
                            }
                        } else {
                            config[type][keyword] = true;
                        }

                        $.create('a').prop({
                            'href' : 'javascript:void(0)',
                            'title' : '删除关键词',
                            'action-type' : 'deleteKeyWord',
                            'action-data' : 'type=' + type
                        }).insert(list).html(keyword);
                    }
                }

                input.val('');
                input = list = null;
                return false;
            },

            'deleteKeyWord' : function(e) {
                var node = $(e.target);
                var type = e.data.type;
                var val = node.html();
                var config = wbp.Config.get();
                if(typeof config[type][val] != 'undefined') {
                    delete config[type][val];
                    node.remove();
                }
            },

            'clearKeyWord' : function(e) {
                var data = e.data;
                wbp.Config.get()[data.type] = {};
                $('#' + data.list).html('');
                //TODO 清空关键词
            },

            'changeTipBackgroundColor' : function(e) {
                wbp.Window.sample.css('backgroundColor', e.target.value);
                //TODO 更改屏蔽提示颜色
            },

            'changeTipTextColor' : function(e) {
                wbp.Window.sample.css('color', e.target.value);
                //TODO 更改屏蔽提示颜色
            },

            'applySettings' : function(e) {  //应用设置
                var config = wbp.Config.get();
                $.each(this.contents.eq(3).find('[type=checkbox]'), function() {
                    var name = this.id.replace('wbpBlock', '');
                    config.hideBlock[name] = !!this.checked;
                })
                wbp.Config.save(config);
                this.contents.eq(4).find('#wbpSettingsString').html(wbp.Config.getString());//更新导入导出显示内容
                wbp.Module.operate();  //操作模块
                wbp.pauseFilter = wbp.Config.get().keywordPaused = $('#wbpKeywordPaused').prop('checked');
                wbp.pauseFilter ? wbp.Filter.restore() : wbp.Filter.filterFeeds();//过滤微博
                this.hide();
            },

            'importSettings' : function(e) {
                var importArea = this.contents.eq(4).find('#wbpSettingsString');
                if(wbp.Config.save(importArea.val())) {
                    $.alert('设置导入成功！');
                } else {
                    $.alert('设置导入失败，JSON格式错误！');
                    importArea.html(wbp.Config.getString()); //出错后还原回最近一次的正确设置
                }
            },

            'blockAll' : function(e) { //全选
                this.contents.eq(this.previousIndex).find('[type=checkbox]').prop('checked', true);
            },

            'blockInvert' : function(e) {  //反选
                $.each(this.contents.eq(this.previousIndex).find('[type=checkbox]'), function() {
                    this.checked = !this.checked;
                })
            },

            'changeTab' : function(e) {
                var index = e.data.index;
                var oldIndex = this.previousIndex;
                if(index != oldIndex) {
                    this.tabs.eq(oldIndex).removeClassName('current').back().eq(index).addClassName('current');
                    this.contents.eq(oldIndex).hide().back().eq(index).show();
                    this.previousIndex = index;
                }
            },

            //关闭窗口，取消按钮两个都会执行该函数。
            'closeWindow' : function() {
                this.hide();
            },

            'checkUpdate' : function() {
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
                            $.alert('脚本已经是最新版。');
                            return;
                        }
                        var features = '';
                        if (text.match(/@features\s+(.*)/)) {
                            features = '<br/>- ' + RegExp.$1.split('；').join('<br/>- ') + '<br/>';
                        }
                        // 显示更新提示
                        $.confirm('“眼不见心不烦”新版本v' + ver + '可用。' + features + '如果您希望更新，请点击“<b>确定</b>”打开脚本页面。', {
                            'OK' : function() {
                                window.open('http://userscripts.org/scripts/show/114087');
                            }
                        })
                    },
                    onerror : function() {
                        $.alert('检查更新出错，请刷新后重新尝试。<br/>若该问题持续存在，请联系作者！');
                    }
                })
            }
        },

        destroy : function() {
            //清理对象
        }
    };

    wbp.Feed = function(node) {
        this.el = node;
        //this.contentEl = $.find('[node-type=feed_list_content]', node)[0];
        //this.forwardEl = $.find('.comment', node)[0];
        //console.log(this.forwardEl);
        //this.forwardContentEl = $.find('[node-type=feed_list_forwardContent]', this.forwardEl)[0];
    };

    wbp.Feed.prototype = {
        constructor : wbp.Feed,

        getFace : function() {
            return this.el.getElementsByTagName('dt')[0].getElementsByTagName('a')[0];
        },

        getNicknameEl : function() { //发布该条微博的昵称
            return this.nickname || (this.nickname = $.find('a[nick-name]', this.el)[0]);
        },

        getContent : function() { //本条微博内容
            return this.content || (this.content = this.contentEl.getElementsByTagName('em')[0].textContent);
        },

        getApp : function() { //发布微博采用的应用
            return this.app || (this.app = $.find('[rel=nofollow]', this.contentEl)[0].textContent);
        },

        getForwardNickname : function() {//转发微博的昵称
            return this.forwardNickname || (this.forwardNickname = $.find('a[nickname]', this.forwardContentEl)[0].textContent);
        },

        getForwardContent : function() {//转发微博正文
            return this.forwardContent || (this.forwardContent = this.forwardContentEl.getElementsByTagName('em')[0].textContent);
        },

        getForwardApp : function() {//转发微博采用的应用
            return this.forwardApp || (this.forwardApp = $.find('[rel=nofollow]', this.forwardContentEl)[0].textContent);
        },

        hide : function() {
            var el = this.el;
            el.style.display = 'none';
            $([el.children[0], el.children[1]]).css({
                'opacity' : 1,
                'display' : ''
            })
            return true;
        },

        show : function() {
           var el = this.el;
           el.style.display = '';
           $([el.children[0], el.children[1]]).css({
               'opacity' : 1,
               'display' : ''
           })
           return true;
       },

        changeToTip : function(keyword) {
            var tipBackColor = wbp.Config.get('tipBackColor') || '#FFD0D0';
            var tipTextColor = wbp.Config.get('tipTextColor') || '#FF8080';

            var showFeed = $.create('a').prop({
                'href' : 'javascript:void(0)',
                'className' : 'notes'
            }).cssText('background-color: ' + tipBackColor + '; border-color: ' + tipTextColor + '; color: ' + tipTextColor + '; margin-bottom: 0px; height: auto;');
            var keywordLink = $.create('a').prop('href', 'javascript:void(0)')
                                .html(keyword)
                                .on('click', this.openWindow); //打开配置窗口
            if (wbp.scope() === 1) {
                showFeed.append($.createText('本条来自'))
                        .append(this.getNicknameEl().cloneNode(true))
                        .append($.createText('的微博因包含关键词“'))
            } else if (wbp.scope() === 2) {
                showFeed.append($.createText('本条微博因包含关键词“'));
            }
            showFeed.append(keywordLink).append($.createText('”而被隐藏，点击显示'))
            showFeed.on('click', this.clickLink.bind(showFeed))
            showFeed.on('mouseover', this.mouseoverLink.bind(showFeed))
            showFeed.on('mouseout', this.mouseoutLink.bind(showFeed, tipBackColor, tipTextColor));
            this.el.insertBefore(showFeed[0], this.el.firstChild);
            return true;
        },

        openWindow : function(e) {
            wbp.Window.show(e);
            e.stopPropagation()
        },

        clickLink : function() {
            this.next().css('opacity', 1).next().css('opacity', 1).back().back().remove();
        },

        mouseoverLink : function() {
            this.cssText('background-color: #D0FFD0; border-color: #40D040; color: #40D040;').next().css({
                'display' : '',
                'opacity' : 0.5
            }).next().css({
                'display' : '',
                'opacity' : 0.5
            })
        },

        mouseoutLink : function(tipBackColor, tipTextColor) {
            this.cssText('background-color: ' + tipBackColor + '; border-color: ' + tipTextColor + '; color: ' + tipTextColor + '; margin-bottom: 0px').next().hide().next().hide().parent().cssText('');
        }
    }

//核心类，过滤、屏蔽、隐藏模块
    wbp.Filter = (function() {
        var currentKeyword;//当前屏蔽的关键词

        var filterFeeds = function(feeds) {
            var config = wbp.Config;
            var feeds = $.find('.feed_list');
            for(var i = 0, len = feeds.length; i < len; i++) {
                filterFeed(new wbp.Feed(feeds[i]), config);
            }
        }


        var filterFeed = function(feed, config) {
            var config = config || wbp.Config;
            var content = feed.el.textContent;
            //var content = feed.getContent() + feed.getForwardContent();
            if (feed.el.children[0].tagName === 'A') {
                $(feed.el).children(0).remove();
            } // 已被屏蔽过

            if(test(config.get('whiteKeywords'), content)) {
                feed.show();
                return true;
            }

            if(test(config.get('blackKeywords'), content)) {
                return feed.hide();
            }

            var links = feed.el.getElementsByTagName('a'), i, len;
            for (i = 0, len = links.length; i < len; ++i) {
                if (links[i].href.substring(0, 12) === 'http://t.cn/' && test(config.get('URLKeywords'), links[i].title)) {
                    return feed.hide();
                }
            }

            if(test(config.get('grayKeywords'), content)) {
                if(!feed.el.isCheck) {
                    $([feed.el.children[0], feed.el.children[1]]).css({
                        'opacity' : 0.5,
                        'display' : 'none'
                    })
                    feed.el.isCheck = true;
                }
                return feed.changeToTip(currentKeyword);;
            } else {
                feed.show();
                feed.el.isCheck = false;
            }
        }

        var test = function(keywords, content) {
            for(var key in keywords) {
                if(typeof keywords[key] != 'boolean') {
                    if(RegExp(keywords[key]).test(content)) {
                        currentKeyword = keywords[key];
                        return true;
                    }
                } else {
                    if(content.indexOf(key) != -1) {
                        currentKeyword = key;
                        return true;
                    }
                }
            }
            return false;
        }
        //暂停屏蔽
        var restore = function() {
            var feeds = $.find('.feed_list');
            for(var i = 0, len = feeds.length; i < len; i++) {
                var feed = feeds[i];
                if (feed.children[0].tagName === 'A') {
                    $(feed).children(0).remove();
                }
                feed.isCheck && (feed.isCheck = false)
                new wbp.Feed(feed).show();
            }
        };

        return {
            filterFeeds : filterFeeds,
            filterFeed : filterFeed,
            restore : restore
        }
    }());

    wbp.init();
} catch(e) {
    //测试期间输出报错信息
    console.log(e);
}