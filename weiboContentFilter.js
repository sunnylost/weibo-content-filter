var doc = document;
var body = doc.body;
var docElement = doc.documentElement;

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
                each.call(this, function(v) {
                    v.style.cssText = text;
                })
                return this;
            }
        },
        //用于设置样式
        css : function(name, value) {
            if(typeof name == 'object') {
                each.call(this, function(v) {
                    each.call(name, function(styleValue, styleName) {
                        v.style[styleName] = styleValue;
                    })
                })
            } else {
                this.style[name] = value;
                return this;
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
            each.call(this, function(v) {
                v.appendChild(child);
            })
            return this;
        },

        html : function(value) {
            if(typeof value == 'undefined') {
                return this[0] && this[0].innerHTML;
            } else {
                each.call(this, function(v) {
                    v.innerHTML = value;
                })
                return this;
            }
        },

        text : function() {
            return this[0].textContent;
        },

        show : function(el) {
            el = el ? [el] : this;
            each.call(el, function(v) {
                v.style.display = 'block';
            })
            return this;
        },

        hide : function(el) {
            el = el ? [el] : this;
            each.call(el, function(v) {
                v.style.display = 'none';
            })
            return this;
        },

        //Event
        on : function(type, fn) {
            each.call(this, function(v) {
                console.log(v);
                v.addEventListener(type, fn, false);
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
            setTimeout(arguments.callee, 10);
            return;
        }
        groups.children(0).append($($.create('li')).html('<span><em><a id="wbpShowSettings" href="javascript:void(0)">眼不见心不烦</a></em></span>'));
        var btn = $('#wbpShowSettings').click(function() {
            that.showSettingsWindow();
        });
        return true;
    },

    loadSettingsWindow : function() {

    },

    showSettingsWindow : function() {
        if(!this.isWindowInitialed) return this.loadSettingsWindow();
        $('#wbpSettingsBack').cssText('background-image: initial; background-attachment: initial; background-origin: initial; background-clip: initial; background-color: black; opacity: 0.3; position: fixed; top: 0px; left: 0px; z-index: 10001; width: ' + window.innerWidth + 'px; height: ' + window.innerHeight + 'px;');
        // Chrome与Firefox的scrollLeft, scrollTop储存于不同位置
        $('#wbpSettings').css({
            'left' : (Math.max(0, body.scrollLeft, docElement.scrollLeft) + event.clientX) + 'px',
            'top' : (Math.max(0, body.scrollTop, docElement.scrollTop) + event.clientY + 10) + 'px',
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
