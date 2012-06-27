// ==UserScript==
// @name			眼不见心不烦（新浪微博）
// @namespace		http://weibo.com/salviati
// @license			MIT License
// @description		在新浪微博（weibo.com）中隐藏包含指定关键词的微博。
// @features		增加对个人/机构认证（黄/蓝V）及微博达人标识的屏蔽
// @version			0.85
// @revision		45
// @author			@富平侯(/salviati)
// @thanksto		@牛肉火箭(/sunnylost)；@JoyerHuang_悦(/collger)
// @include			http://weibo.com/*
// @include			http://www.weibo.com/*
// ==/UserScript==

var $version, $revision;
var $uid;
var $blocks = [ // 模块屏蔽设置
		['Topic', '#pl_content_promotetopic, #trustPagelete_zt_hottopic'],
		['InterestUser', '#pl_content_homeInterest, #trustPagelete_recom_interest'],
		['InterestApp', '#pl_content_allInOne, #trustPagelete_recom_allinone'],
		['Notice', '#pl_common_noticeboard, #pl_rightmod_noticeboard'],
		['HelpFeedback', '#pl_common_help, #pl_common_feedback, #pl_rightmod_help, #pl_rightmod_feedback, #pl_rightmod_tipstitle'],
		['Ads', '#plc_main .W_main_r div[id^="ads_"], div[ad-data], #ads_bottom_1'],
		['PullyList', '#pl_content_pullylist, #pl_content_biztips'],
		['RecommendedTopic', '#pl_content_publisherTop div[node-type="recommendTopic"]'],
		['Mood', '#pl_content_mood'],
		['Medal', '#pl_content_medal, #pl_rightmod_medal, .declist'],
		['Game', '#pl_leftNav_game'],
		['App', '#pl_leftNav_app'],
		['Tasks', '#pl_content_tasks'],
		['Promotion', '#pl_rightmod_promotion, #trustPagelet_ugrowth_invite'],
		['Level', '#pl_content_personInfo p.level, #pl_leftNav_common dd.nameBox p, #pl_content_hisPersonalInfo span.W_level_ico'],
		['Member', '#trustPagelet_recom_member'],
		['MemberIcon', '.ico_member'],
		['VerifyIcon', '.approve, .approve_co'],
		['DarenIcon', '.ico_club']
	];
var $options = {};

var _ = function (s) {
	return document.getElementById(s);
};

var __ = function (s) {
	return document.querySelector(s);
};
// 绑定事件
var bind = function (el, eventName, handler) {
	if (el) {el.addEventListener(eventName, handler, false); }
};
// click事件快捷方式
var click = function (el, handler) {
	bind(el, 'click', handler);
};

// Chrome提供的GM_getValue()等有问题（早期版本则不支持），需要使用localStorage重新定义
// Firefox 2+, Internet Explorer 8+, Safari 4+和Chrome均支持DOM Storage (HTML5)
if (window.localStorage) {
	var keyRoot = 'weiboPlus.';

	var GM_deleteValue = function (name) {
		localStorage.removeItem(keyRoot + name);
	};

	var GM_getValue = function (name, defval) {
		return localStorage.getItem(keyRoot + name) || defval;
	};

	var GM_setValue = function (name, value) {
		localStorage.setItem(keyRoot + name, value);
	};
}

if (!window.chrome) {
	// 非Chrome浏览器，优先使用unsafeWindow获取全局变量
	// 由于varname中可能包括'.'，因此使用eval()获取变量值
	var getGlobalVar = function (varname) {
		return eval('unsafeWindow.' + varname);
	};
} else {
	// Chrome原生不支持unsafeWindow，脚本运行在沙箱中，因此不能访问全局变量。
	// 但用户脚本与页面共享DOM，所以可以设法将脚本注入host页
	// 详见http://voodooattack.blogspot.com/2010/01/writing-google-chrome-extension-how-to.html
	var getGlobalVar = function (varname) {
		var elem = document.createElement('script'), id = '';
		// 生成脚本元素的随机索引
		while (id.length < 16) {
			id += String.fromCharCode(((!id.length || Math.random() > 0.5) ? 0x61 + Math.floor(Math.random() * 0x19) : 0x30 + Math.floor(Math.random() * 0x9)));
		}
		// 生成脚本
		elem.id = id;
		elem.type = 'text/javascript';
		elem.innerHTML = '(function(){document.getElementById("' + id + '").innerText=' + varname + '; }());';
		// 将元素插入DOM（马上执行脚本）
		document.head.appendChild(elem);
		// 获取返回值
		var ret = elem.innerText;
		// 移除元素
		document.head.removeChild(elem);
		elem = null;
		return ret;
	};
}

function getScope() {
	return "B_index" === document.body.className ? 1 : "B_my_profile_other" === document.body.className ? 2 : 0;
}

// 搜索指定文本中是否包含列表中的关键词
function searchKeyword(str, key) {
	var text = str.toLowerCase(), keywords = $options[key], keyword, i, len;
	if (keywords === undefined) {return ''; }
	for (i = 0, len = keywords.length; i < len; ++i) {
		keyword = keywords[i];
		if (!keyword) {continue; }
		if (keyword.length > 2 && keyword.charAt(0) === '/' && keyword.charAt(keyword.length - 1) === '/') {
			try {
				// 尝试匹配正则表达式
				if (RegExp(keyword.substring(1, keyword.length - 1)).test(str)) {return keyword; }
			} catch (e) {
				continue;
			}
		} else if (text.indexOf(keyword.toLowerCase()) > -1) {
			return keyword;
		}
	}
	return '';
}

function filterFeed(node) {
	if (node.firstChild.tagName === 'A') {node.removeChild(node.firstChild); } // 已被屏蔽过
	var content, scope = getScope();
	switch (scope) {
	case 1:
		content = node.childNodes[3];
		break;
	case 2:
		content = node.childNodes[1]; // 他人主页的微博没有用户信息
		break;
	default:
		return false;
	}
	if (content.tagName !== 'DD' || !content.classList.contains('content')) {return false; }
	// 在微博内容中搜索屏蔽关键词
	if ($options.keywordPaused || searchKeyword(content.textContent, 'whiteKeywords')) {
		node.style.display = '';
		node.childNodes[1].style.display = '';
		node.childNodes[3].style.display = '';
		node.childNodes[1].style.opacity = 1;
		node.childNodes[3].style.opacity = 1;
		return false;
	}
	if (searchKeyword(content.textContent, 'blackKeywords')) {
		node.style.display = 'none'; // 直接隐藏，不显示屏蔽提示
		return true;
	}
	var links = content.getElementsByTagName('A'), i, len;
	for (i = 0, len = links.length; i < len; ++i) {
		if (links[i].href.substring(0, 12) === 'http://t.cn/' && searchKeyword(links[i].title, 'URLKeywords')) {
			node.style.display = 'none';
			return true;
		}
	}
	node.style.display = '';
	var keyword = searchKeyword(content.textContent, 'grayKeywords');
	if (!keyword) {
		node.childNodes[1].style.display = '';
		node.childNodes[3].style.display = '';
		node.childNodes[1].style.opacity = 1;
		node.childNodes[3].style.opacity = 1;
		return false;
	}
	var authorClone;
	if (scope === 1) {
		// 2011年11月15日起，新浪微博提供了屏蔽功能，由于屏蔽按钮的存在，微博发布者链接的位置发生了变化
		var author = content.childNodes[3].childNodes[1];
		if (author.tagName !== 'A') {return false; } // 不要屏蔽自己的微博
		node.childNodes[3].style.display = 'none';
		// 添加隐藏提示链接
		authorClone = author.cloneNode(false);
		// 默认的用户链接中多了一个换行符和两个tab
		authorClone.innerHTML = '@' + author.innerHTML.slice(3);
	}
	// 找到了待隐藏的微博
	node.childNodes[1].style.display = 'none';
	var tipBackColor = $options.tipBackColor || '#FFD0D0';
	var tipTextColor = $options.tipTextColor || '#FF8080';
	var showFeed = document.createElement('a');
	showFeed.href = 'javascript:void(0)';
	showFeed.className = 'notes';
	showFeed.style.cssText = 'background-color: ' + tipBackColor + '; border-color: ' + tipTextColor + '; color: ' + tipTextColor + '; margin-bottom: 0px; height: auto;';
	var keywordLink = document.createElement('a');
	keywordLink.href = 'javascript:void(0)';
	keywordLink.innerHTML = keyword;
	click(keywordLink, function (event) {
		showSettingsWindow(event);
		event.stopPropagation(); // 防止事件冒泡触发屏蔽提示的onclick事件
	});
	if (scope === 1) {
		showFeed.appendChild(document.createTextNode('本条来自'));
		showFeed.appendChild(authorClone);
		showFeed.appendChild(document.createTextNode('的微博因包含关键词“'));
	} else if (scope === 2) {
		showFeed.appendChild(document.createTextNode('本条微博因包含关键词“'));
	}
	showFeed.appendChild(keywordLink);
	showFeed.appendChild(document.createTextNode('”而被隐藏，点击显示'));
	click(showFeed, function () {
		this.parentNode.childNodes[2].style.opacity = 1;
		this.parentNode.childNodes[4].style.opacity = 1;
		this.parentNode.removeChild(this);
	});
	bind(showFeed, 'mouseover', function () {
		this.parentNode.childNodes[2].style.display = '';
		this.parentNode.childNodes[4].style.display = '';
		this.parentNode.childNodes[2].style.opacity = 0.5;
		this.parentNode.childNodes[4].style.opacity = 0.5;
		this.style.cssText = 'background-color: #D0FFD0; border-color: #40D040; color: #40D040;';
	});
	bind(showFeed, 'mouseout', function () {
		if (!this.parentNode) {return; }
		this.parentNode.childNodes[2].style.display = 'none';
		this.parentNode.childNodes[4].style.display = 'none';
		this.parentNode.style.cssText = '';
		this.style.cssText = 'background-color: ' + tipBackColor + '; border-color: ' + tipTextColor + '; color: ' + tipTextColor + '; margin-bottom: 0px';
	});
	node.insertBefore(showFeed, node.firstChild);
	return true;
}

var $reloadTimerID = null;

// 处理动态载入内容
function onDOMNodeInsertion(event) {
	if (getScope() === 0) {return false; }
	var node = event.target;
	if (node.tagName === 'DL' && node.classList.contains('feed_list')) {
		// 处理动态载入的微博
		return filterFeed(node);
	}
	if (node.tagName === 'DIV' && node.getAttribute('node-type') === 'feed_nav') {
		// 由于新浪微博使用了BigPipe技术，从"@我的微博"等页面进入时只载入部分页面
		// 需要重新载入设置页面、按钮及刷新微博列表
		if ($reloadTimerID !== null) {
			clearTimeout($reloadTimerID);
			$reloadTimerID = null;
		}
		loadSettingsWindow();
		showSettingsBtn();
	} else if (node.tagName === 'DIV' && node.classList.contains('feed_lists')) {
		// 微博列表作为pagelet被一次性载入
		applySettings();
	} else if ($reloadTimerID === null && !_('wbpShowSettings')) {
		// 由于各版块载入顺序不定，有时设置窗口及按钮未载入，使用定时器保险
		$reloadTimerID = setTimeout(reloadTimer, 1000);
	}
	return false;
}

function reloadTimer() {
	if (getScope() === 0 || (loadSettingsWindow() && showSettingsBtn())) {
		$reloadTimerID = null;
	} else {
		$reloadTimerID = setTimeout(reloadTimer, 1000);
	}
}

// 检查更新
function checkUpdate() {
	GM_xmlhttpRequest({
		method: 'GET',
		// 只载入metadata
		url: 'http://userscripts.org/scripts/source/114087.meta.js',
		onload: function (result) {
			if (!result.responseText.match(/@version\s+(.*)/)) {return; }
			var ver = RegExp.$1;
			if (!result.responseText.match(/@revision\s+(\d+)/) || RegExp.$1 <= $revision) {
				alert('脚本已经是最新版。');
				return;
			}
			var features = '';
			if (result.responseText.match(/@features\s+(.*)/)) {
				features = '- ' + RegExp.$1.split('；').join('\n- ') + '\n\n';
			}
			// 显示更新提示
			if (confirm('“眼不见心不烦”新版本v' + ver + '可用。\n\n' + features + '如果您希望更新，请点击“确认”打开脚本页面。')) {
				window.open('http://userscripts.org/scripts/show/114087');
			}
		}
	});
}

function showSettingsWindow(event) {
	_('wbpSettingsBack').style.cssText = 'background-image: initial; background-attachment: initial; background-origin: initial; background-clip: initial; background-color: black; opacity: 0.3; position: fixed; top: 0px; left: 0px; z-index: 10001; width: ' + window.innerWidth + 'px; height: ' + window.innerHeight + 'px;';
	var block = _('wbpSettings');
	// Chrome与Firefox的scrollLeft, scrollTop储存于不同位置
	var left = document.body.scrollLeft === 0 ? document.documentElement.scrollLeft : document.body.scrollLeft;
	var top = document.body.scrollTop === 0 ? document.documentElement.scrollTop : document.body.scrollTop;
	block.style.left = (left + event.clientX) + 'px';
	block.style.top = (top + event.clientY + 10) + 'px';
	block.style.display = '';
}

function showSettingsBtn() {
	// 设置标签已经置入页面
	if (_('wbpShowSettings')) {return true; }
	var groups = __('#pl_content_homeFeed .nfTagB, #pl_content_hisFeed .nfTagB');
	// Firefox的div#pl_content_homeFeed载入时是空的，此时无法置入页面，稍后由onDOMNodeInsertion()处理
	if (!groups) {return false; }
	var showSettingsTab = document.createElement('li');
	showSettingsTab.innerHTML = '<span><em><a id="wbpShowSettings" href="javascript:void(0)">眼不见心不烦</a></em></span>';
	groups.childNodes[1].appendChild(showSettingsTab);
	click(_('wbpShowSettings'), showSettingsWindow);
	return true;
}

// 根据当前设置屏蔽/显示所有内容
function applySettings() {
	// 处理非动态载入内容
	var feeds = document.querySelectorAll('.feed_list'), i, len, j, l;
	for (i = 0, len = feeds.length; i < len; ++i) {filterFeed(feeds[i]); }
	// 屏蔽版面内容
	var cssText = '';
	for (i = 0, len = $blocks.length; i < len; ++i) {
		if ($options.hideBlock && $options.hideBlock[$blocks[i][0]] === true) {
			cssText += $blocks[i][1];
			if ($blocks[i][0] === 'RecommendedTopic') {
				// 推荐话题的display属性在微博输入框获得焦点时被重置，
				// 因此需要通过设置visibility属性实现隐藏
				cssText += ' { visibility: hidden; } ';
			} else {
				cssText += ' { display: none; } ';
			}
		}
	}
	blockStyles = _('wbpBlockStyles');
	if (!blockStyles) {
		blockStyles = document.createElement('style');
		blockStyles.type = 'text/css';
		blockStyles.id = 'wbpBlockStyles';
		document.head.appendChild(blockStyles);
	}
	blockStyles.innerHTML = cssText + '\n';
}

// 从显示列表建立关键词数组
function getKeywords(id) {
	if (!_(id).hasChildNodes()) {return []; }
	var keywords = _(id).childNodes, list = [], i, len;
	for (i = 0, len = keywords.length; i < len; ++i) {
		if (keywords[i].tagName === 'A') {list.push(keywords[i].innerHTML); }
	}
	return list;
}

// 将关键词添加到显示列表
function addKeywords(id, list) {
	var keywords = list instanceof Array ? list : list.split(' '),
		i, len, malformed = [];
	for (i = 0, len = keywords.length; i < len; ++i) {
		var currentKeywords = ' ' + getKeywords(id).join(' ') + ' ', keyword = keywords[i];
		if (keyword && currentKeywords.indexOf(' ' + keyword + ' ') === -1) {
			var keywordLink = document.createElement('a');
			if (keyword.length > 2 && keyword.charAt(0) === '/' && keyword.charAt(keyword.length - 1) === '/') {
				try {
					// 尝试创建正则表达式，检验正则表达式的有效性
					// 调用test()是必须的，否则浏览器可能跳过该语句
					RegExp(keyword.substring(1, keyword.length - 1)).test('');
				} catch (e) {
					malformed.push(keyword);
					continue;
				}
				keywordLink.className = 'regex';
			}
			keywordLink.title = '删除关键词';
			keywordLink.href = 'javascript:void(0)';
			keywordLink.innerHTML = keyword;
			_(id).appendChild(keywordLink);
		}
	}
	if (malformed.length > 0) {
		alert('下列正则表达式无效：\n' + malformed.join('\n'));
	}
	return malformed.join(' ');
}

// 点击删除关键词（由上级div冒泡事件处理）
function deleteKeyword(event) {
	if (event.target.tagName === 'A') {
		event.target.parentNode.removeChild(event.target);
		event.stopPropagation();
	}
}

// 根据当前设置（可能未保存）更新$options
function updateSettings() {
	$options = {
		keywordPaused : _('wbpKeywordPaused').checked,
		whiteKeywords : getKeywords('wbpWhiteKeywordList'),
		blackKeywords : getKeywords('wbpBlackKeywordList'),
		grayKeywords : getKeywords('wbpGrayKeywordList'),
		URLKeywords : getKeywords('wbpURLKeywordList'),
		tipBackColor : _('wbpTipBackColor').value,
		tipTextColor : _('wbpTipTextColor').value,
		hideBlock : {}
	};
	var i, len;
	for (i = 0, len = $blocks.length; i < len; ++i) {
		$options.hideBlock[$blocks[i][0]] = _('wbpBlock' + $blocks[i][0]).checked;
	}
	_('wbpSettingsString').value = JSON.stringify($options);
}

// 重新载入设置（丢弃未保存设置）
function reloadSettings(str) {
	$options = {};
	var options = str || GM_getValue($uid.toString(), '');
	if (options) {
		try {
			$options = JSON.parse(options.replace(/\n/g, ''));
			if (typeof $options !== 'object') {throw 0; }
		} catch (e) {
			if (str) {
				alert('设置导入失败！\n设置信息格式有问题。');
				return false;
			}
			alert('“眼不见心不烦”设置读取失败！\n设置信息格式有问题。');
		}
	}
	_('wbpKeywordPaused').checked = ($options.keywordPaused === true);
	_('wbpWhiteKeywordList').innerHTML = '';
	_('wbpBlackKeywordList').innerHTML = '';
	_('wbpGrayKeywordList').innerHTML = '';
	_('wbpURLKeywordList').innerHTML = '';
	addKeywords('wbpWhiteKeywordList', $options.whiteKeywords || '');
	addKeywords('wbpBlackKeywordList', $options.blackKeywords || '');
	addKeywords('wbpGrayKeywordList', $options.grayKeywords || '');
	addKeywords('wbpURLKeywordList', $options.URLKeywords || '');
	_('wbpWhiteKeywords').value = '';
	_('wbpBlackKeywords').value = '';
	_('wbpGrayKeywords').value = '';
	_('wbpURLKeywords').value = '';
	var tipBackColor = $options.tipBackColor || '#FFD0D0';
	var tipTextColor = $options.tipTextColor || '#FF8080';
	_('wbpTipBackColor').value = tipBackColor;
	_('wbpTipTextColor').value = tipTextColor;
	var tipSample = _('wbpTipSample');
	tipSample.style.backgroundColor = tipBackColor;
	tipSample.style.borderColor = tipTextColor;
	tipSample.style.color = tipTextColor;
	if ($options.hideBlock) {
		var i, len;
		for (i = 0, len = $blocks.length; i < len; ++i) {
			_('wbpBlock' + $blocks[i][0]).checked = ($options.hideBlock[$blocks[i][0]] === true);
		}
	}
	_('wbpSettingsString').value = JSON.stringify($options);
	return true;
}

function loadSettingsWindow() {
	if (_('wbpSettings')) {return true; }
	$uid = getGlobalVar('$CONFIG.uid');
	if (!$uid) {return false; }

	// 加入选项设置
	GM_addStyle('#settings.css#');
	var keywordBack = document.createElement('div');
	keywordBack.id = 'wbpSettingsBack';
	keywordBack.style.display = 'none';
	var keywordBlock = document.createElement('div');
	keywordBlock.className = 'W_layer';
	keywordBlock.id = 'wbpSettings';
	keywordBlock.style.cssText = 'width: 600px; margin-left: -300px; z-index: 10001; position: absolute; display: none;';
	keywordBlock.innerHTML = '#settings.html#';
	document.body.appendChild(keywordBack);
	document.body.appendChild(keywordBlock);
	_('wbpSettingsTitle').innerHTML = '“眼不见心不烦”(v' + $version + ')设置';
	// 修改屏蔽提示颜色事件
	bind(_('wbpTipBackColor'), 'blur', function () {
		_('wbpTipSample').style.backgroundColor = this.value;
	});
	bind(_('wbpTipTextColor'), 'blur', function () {
		var wbpTipSample = _('wbpTipSample');
		wbpTipSample.style.borderColor = this.value;
		wbpTipSample.style.color = this.value;
	});
	// 添加关键词按钮点击事件
	click(_('wbpAddWhiteKeyword'), function () {
		_('wbpWhiteKeywords').value = addKeywords('wbpWhiteKeywordList', _('wbpWhiteKeywords').value);
	});
	click(_('wbpAddBlackKeyword'), function () {
		_('wbpBlackKeywords').value = addKeywords('wbpBlackKeywordList', _('wbpBlackKeywords').value);
	});
	click(_('wbpAddGrayKeyword'), function () {
		_('wbpGrayKeywords').value = addKeywords('wbpGrayKeywordList', _('wbpGrayKeywords').value);
	});
	click(_('wbpAddURLKeyword'), function () {
		_('wbpURLKeywords').value = addKeywords('wbpURLKeywordList', _('wbpURLKeywords').value);
	});
	// 清空关键词按钮点击事件
	click(_('wbpClearWhiteKeyword'), function () {
		_('wbpWhiteKeywordList').innerHTML = '';
	});
	click(_('wbpClearBlackKeyword'), function () {
		_('wbpBlackKeywordList').innerHTML = '';
	});
	click(_('wbpClearGrayKeyword'), function () {
		_('wbpGrayKeywordList').innerHTML = '';
	});
	click(_('wbpClearURLKeyword'), function () {
		_('wbpURLKeywordList').innerHTML = '';
	});
	// 删除关键词事件
	click(_('wbpWhiteKeywordList'), deleteKeyword);
	click(_('wbpBlackKeywordList'), deleteKeyword);
	click(_('wbpGrayKeywordList'), deleteKeyword);
	click(_('wbpURLKeywordList'), deleteKeyword);
	// 标签点击事件
	click(_('wbpTabHeaders'), function (event) {
		var node = event.target, i, len;
		if (node && node.tagName === 'A') {
			node.className = 'current';
			_(node.getAttribute('tab')).style.display = '';
			for (i = 0, len = this.childNodes.length; i < len; ++i) {
				if (node !== this.childNodes[i]) {
					this.childNodes[i].className = '';
					_(this.childNodes[i].getAttribute('tab')).style.display = 'none';
				}
			}
			event.stopPropagation();
		}
	});
	click(_('wbpTabHeaderSettings'), updateSettings);
	click(_('wbpBlockAll'), function () {
		var i, len;
		for (i = 0, len = $blocks.length; i < len; ++i) {
			_('wbpBlock' + $blocks[i][0]).checked = true;
		}
	});
	click(_('wbpBlockInvert'), function () {
		var i, len, item;
		for (i = 0, len = $blocks.length; i < len; ++i) {
			item = _('wbpBlock' + $blocks[i][0]);
			item.checked = !item.checked;
		}
	});
	// 对话框按钮点击事件
	click(_('wbpImportBtn'), function () {
		if (reloadSettings(_('wbpSettingsString').value)) {alert('设置导入成功！'); }
	});
	click(_('wbpOKBtn'), function () {
		updateSettings();
		GM_setValue($uid.toString(), JSON.stringify($options));
		_('wbpSettingsBack').style.display = 'none';
		_('wbpSettings').style.display = 'none';
		applySettings();
	});
	click(_('wbpCancelBtn'), function () {
		reloadSettings();
		_('wbpSettingsBack').style.display = 'none';
		_('wbpSettings').style.display = 'none';
	});
	click(_('wbpCloseBtn'), function () {
		reloadSettings();
		_('wbpSettingsBack').style.display = 'none';
		_('wbpSettings').style.display = 'none';
	});

	reloadSettings();
	click(_('wbpCheckUpdate'), checkUpdate);
	return true;
}

// 仅在个人首页与他人页面生效
if (getScope() !== 0) {
	loadSettingsWindow();
	showSettingsBtn();
	applySettings();
}

// 处理动态载入内容
document.addEventListener('DOMNodeInserted', onDOMNodeInsertion, false);