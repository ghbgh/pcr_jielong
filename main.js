 // 大写为常量, 不应修改
 const pcr = new Object;
 window.pcr = pcr; // root
 pcr.MAX_FIND_DEEP = 4;
 pcr.MODE_GAME = 'gameMode';
 pcr.MODE_MARK = 'markMode';
 pcr.MODE_TARGET = 'targetMode';
 pcr.clickHistory = new Set(JSON.parse(localStorage.getItem("clickedHistory") || '[]')); // 已点击集合
 pcr.mode = pcr.MODE_GAME;
 pcr.showName = true;

 pcr.MODE_CONFIG = {
     'gameMode': {
         alwayDrawAll: false,
         help: '左键点击图片将标记为已选择过并显示其接龙, 右键单击图片将不标记仅继续接龙, <s>用于非玩家回合时使用。</s>(才知道100%成就好像不需要玩家亲自点击, 我傻了)',
         clickEvent: function (e) {
             const tailWord = e.currentTarget.dataset.tail;
             const name = e.currentTarget.dataset.name;
             const iconID = e.currentTarget.dataset.iconId;
             switch (e.which) {
                 case 1:
                     addClickHistory(name, iconID);
                     if (isFocusTarget(name, iconID)) {
                         // 完成目标，移除
                         pcr.focusTarget = undefined;
                     }
                     process(tailWord);
                     break;
                 case 3:
                     process(tailWord);
                     break;
                 default:
                     break;
             }
         }
     },
     'markMode': {
         alwayDrawAll: true,
         help: '左键点击图片将标记为已选择，右键单击图片将移除已选择标记。',
         clickEvent: function (e) {
             const name = e.currentTarget.dataset.name;
             const iconID = e.currentTarget.dataset.iconId;
             switch (e.which) {
                 case 1:
                     if (addClickHistory(name, iconID))
                         reDraw();
                     break;
                 case 3:
                     if (removeClickHistory(name, iconID))
                         reDraw();
                     break;
                 default:
                     break;
             }
         }
     },
     'targetMode': {
         alwayDrawAll: true,
         help: '选择一个图片作为最终目标，游戏模式中将会进行追踪。已优化原算法',
         clickEvent: function (e) {
             switch (e.which) {
                 case 1:
                     pcr.focusTarget = {
                         name: e.currentTarget.dataset.name,
                         iconID: e.currentTarget.dataset.iconId,
                         tail: e.currentTarget.dataset.tail,
                         head: e.currentTarget.dataset.head
                     };
                     reDraw();
                     break;
                 default:
                     break;
             }
         }
     }
 };

 $.ajax('data.json')
     .done(data => {
		 if (typeof(data) == "string") data = JSON.parse(data);
         pcr.META = data.meta;
         pcr.DATA_ARRAY = data.data;
         pcr.SAME_META = [];
         data.sameMeta.forEach(arr => pcr.SAME_META.push(new Set(arr)));
         pcr.DATA_MAP = {
             head: {},
             tail: {}
         };
         pcr.DATA_ARRAY.forEach(e => {
             let headArray, tailArray;

             pcr.SAME_META.forEach(set => {
                 if (!set.has(e.head)) return;
                 set.forEach(meta => {
                     if (pcr.DATA_MAP.head[meta]) headArray = pcr.DATA_MAP.head[meta];
                 });
             });

             headArray = headArray || pcr.DATA_MAP.head[e.head] || [];
             tailArray = pcr.DATA_MAP.tail[e.tail] || [];
             headArray.push(e);
             tailArray.push(e);
             pcr.DATA_MAP.head[e.head] = headArray;
             pcr.DATA_MAP.tail[e.tail] = tailArray;
         });
         initData();
     }).catch(() => {
         $("#meta").text('加载data.json失败，请刷新页面。');
     });

 $("#modeSelector #gameMode").click(e => {
     changeMode(pcr.MODE_GAME);
 });
 $("#modeSelector #markMode").click(e => {
     changeMode(pcr.MODE_MARK);
 });
 $("#modeSelector #targetMode").click(e => {
     changeMode(pcr.MODE_TARGET);
 });

 $("#clearClickHistory").click(e => {
     localStorage.removeItem('clickedHistory');
     pcr.clickHistory.clear();
     reDraw();
 });

 $("#showName").click(e => {
     pcr.showName = e.currentTarget.checked;
     reDraw();
 });

 $("#disableRightClick").click(e => {
     if (e.currentTarget.checked) {
         $(document).bind('contextmenu', e => false);
     } else {
         $(document).unbind('contextmenu');
     }
 });

 $("#showNextUnClick").change(e => {
     const num = parseInt(e.currentTarget.value);
     pcr.showNextUnClick = num;
     reProcess();
 });

 $("#grayUnClick").change(e => {
     pcr.grayShowUnClick = e.currentTarget.checked;
     reDraw();
 });

 $("#unClickAlwayHead").change(e => {
     pcr.unClickAlwayHead = e.currentTarget.checked;
     reProcess();
 })

 function changeMode(mode) {
     const conf = pcr.MODE_CONFIG[mode];
     pcr.mode = mode;

     $(`#modeSelector #${mode}`).addClass('active').siblings().removeClass('active');
     $('#modeSelector .help').html(`<span>${conf.help}</span>`);

     if (conf.alwayDrawAll) {
         process(null);
     } else {
         process(pcr.preWord);
     }
 }

 function initData() {
     const metaDiv = $("#meta");
     metaDiv.empty();
     pcr.META.forEach(e => {
         metaDiv.append($(`<div>${e}</div>`));
     });
     $('#meta').on('click', 'div', e => {
         let divText = e.currentTarget.textContent.trim();
         process(divText);
     });
     pcr.showNextUnClick = parseInt($("#showNextUnClick").val());
     pcr.unClickAlwayHead = $("#unClickAlwayHead").prop("checked");
     $(document).bind('contextmenu', e => false); // 为了支持右键点击, 禁用右键菜单
     changeMode(pcr.mode);
     $("#popWindow").addClass("hide");
 }

 function reProcess() {
     process(pcr.preWord);
 }

 function reDraw() {
     draw(pcr.preData);
 }

 /**
  * 传入null将渲染所有选项，null不会覆盖上次的选项。
  **/
 function process(word) {
     $("#popWindow").removeClass("hide");

     // 让出执行权渲染遮罩
     setTimeout(() => {
         if (word == null) {
             pcr.preData = {
                 all: [...pcr.DATA_ARRAY]
             };
         } else {
             let dataArray;
             pcr.preWord = word;
             dataArray = [];
             eachMatchedWord(word, 1, e => {
                 // 复制对象，确保后续修改不影响源数据
                 dataArray.push(Object.assign({}, e));
             });

             if (pcr.focusTarget) {
                 pcr.preData = splitDataArray(dataArray);
             } else {
                 pcr.preData = {
                     all: dataArray
                 };
             }
         }
         [pcr.preData.all, pcr.preData.focus, pcr.preData.normal].forEach(dataArray => {
             calcNextUnClick(dataArray);
             sortDataArray(dataArray);
         });

         draw(pcr.preData);
         $("#popWindow").addClass("hide");
     }, 0);
 }

 function calcNextUnClick(dataArray) {
     if (dataArray == null) return;

     if (pcr.showNextUnClick == 0) {
         dataArray.forEach(data => {
             data.nextUnClick = 0;
         })
         return;
     };
	 //记录一下同尾部的结果稍微优化一下
	 //当然也可以一开始就打表，但是懒
	 let tailToCount = new Map();
     dataArray.forEach(data => {
		 let unClickCount = 0;
		 if (tailToCount[data.tail] == null)
		 {
			 deep_map = calcDistance(data);
			 for (let k in deep_map) {
				 if(!isClickedByKey(k) && deep_map[k] <= pcr.showNextUnClick) unClickCount++;
			 }
			 tailToCount[data.tail] = unClickCount;
		 }
		 data.nextUnClick = tailToCount[data.tail];
     });
 }

 function sortDataArray(dataArray) {
     if (dataArray == null) return;
     dataArray.sort((l, r) => {
         // 未点击的始终排在最前
         if (pcr.unClickAlwayHead) {
             const lUnClick = isUnClicked(l),
                 rUnClick = isUnClicked(r);
             if (lUnClick && !rUnClick) return -1;
             if (rUnClick && !lUnClick) return 1;
         }

         // 之后按下一步未点数量排序, 如果未启用下一步计算则跳过
         if (r.nextUnClick > l.nextUnClick) return 1;
         if (l.nextUnClick > r.nextUnClick) return -1;

         // 最后按目标进度排序
         if (pcr.focusTarget) {
             return l.deep - r.deep;
         }
         return l.iconID - r.iconID;
     });
 }

 //bfs一下, 对于每个起点是O(N)的
 function calcDistance(src, reverse = false)
 {
	 let deep_map = new Map();
	 deep_map[src.iconID + src.name] = 0;
	 let queue = [src];
	 let l = 0, r = 0;
	 while (l <= r) {
		 let u = queue[l];
		 let dep = deep_map[u.iconID + u.name];
		 if (dep != null) {
			 if (!reverse)
			 {
				 eachMatchedWord(u.tail, 1, v => {
					 if (deep_map[v.iconID + v.name] == null) {
						 deep_map[v.iconID + v.name] = dep + 1;
						 queue.push(v);
						 r++;
					 }
				 });
			 } else {
				 eachMatchedWordHead(u.head, 1, v => {
					 if (deep_map[v.iconID + v.name] == null) {
						 deep_map[v.iconID + v.name] = dep + 1;
						 queue.push(v);
						 r++;
					 }
				 });
			 }
		 }
		 l++;
	 }
	 return deep_map;
 }
 
 function splitDataArray(dataArray) {
     const focus = [],
         normal = [];
	 if (pcr.focusTarget) {
		deep_map = calcDistance(pcr.focusTarget, true);
	 }
     dataArray.forEach(data => {
         if (isFocusTarget(data.name, data.iconID)) {
             // 把目标插入到最前边
             data.deep = 0;
             focus.splice(0, 0, data);
             return;
         }
         let deep = deep_map[data.name + data.iconID];//isRoad(data, 1);
         if (deep != null && deep > 0) {
             data.deep = deep;
             focus.push(data);
         } else {
             normal.push(data);
         }
     });

     if (focus.length > 0) {
         focus.sort((l, r) => {
             return l.deep - r.deep;
         });
     }

     return {
         focus: focus,
         normal: normal
     };
 }

 // 返回到达目标节点所需的次数，返回-1表示不可达
 // function isRoad(data, deep) {
     // if (isMatchWord(pcr.focusTarget, data.tail)) return deep;
     // if (deep >= pcr.MAX_FIND_DEEP) return -1;

     // deep++;
     // let minDeep = -1;
     // eachMatchedWord(data.tail, 1, nextData => {
         // let nextDeep = isRoad(nextData, deep);
         // if (nextDeep > 0) {
             // minDeep = minDeep == -1 ? nextDeep : Math.min(minDeep, nextDeep);
         // }
     // })
     // return minDeep;
 // }

 function isMatchWord(e, selectWord) {
     if (selectWord == null || e.head === selectWord) return true;
     return pcr.SAME_META.some(set => set.has(selectWord) && set.has(e.head));
 }

 function isFocusTarget(name, iconID) {
     return pcr.focusTarget && pcr.focusTarget.name === name && pcr.focusTarget.iconID == iconID
 }

 function draw(configData) {
     $(`#meta>div:contains('${pcr.preWord}')`)
         .map((i, v) => v.innerText === pcr.preWord ? v : undefined)
         .addClass('active').siblings().removeClass('active');

     let htmlArray = [];

     // 统计当前页未点击数量
     let unClickCount = 0;

     function eachHandle(config) {
         if (isUnClicked(config)) unClickCount++;
     }

     // 通向标记，当显示全部时不显示
     if (pcr.focusTarget && !configData.all) {
         htmlArray.push(`<div class="hr">通向目标"${pcr.focusTarget.name}"</div>`);
         configData.focus && configData.focus.forEach(config => {
             htmlArray.push(buildShowDiv(config));
             eachHandle(config);
         });

		 if (configData.normal && configData.normal.length > 0) {
			 htmlArray.push(`<div class="hr">不通向目标</div>`);
		 }
		 configData.normal && configData.normal.forEach(config => {
             htmlArray.push(buildShowDiv(config));
             eachHandle(config);
         });
     } else {
         // 渲染所有
         configData.all && configData.all.forEach(config => {
             htmlArray.push(buildShowDiv(config));
             eachHandle(config);
         });
     }
     htmlArray.splice(0, 0, `<div class="hr ${unClickCount == 0 ? 'all-clicked' : ''}">
                                         ${unClickCount == 0 ? "当前页已全部点击" : `当前页有${unClickCount}个尚未点击`}</div>`);

     const gameDiv = $('#game');
     gameDiv.empty();
     gameDiv.append(htmlArray.join(''))
         .children('.grid').mousedown(e => pcr.MODE_CONFIG[pcr.mode].clickEvent(e));
 }

 function buildShowDiv(config) {
     return `<div class="grid" data-head="${config.head}" data-tail="${config.tail}" data-name="${config.name}" data-icon-id="${config.iconID}" >
             <div class="icon ${pcr.grayShowUnClick && !isUnClicked(config) ? 'gray-scale' : ''}" icon-id="${config.iconID}" title="${config.name}">
                 ${isClicked(config.name, config.iconID) ? '<img src="dui.png" class="clicked"/>' : ""}
                 ${pcr.showName ? `<span class="${config.type}">${config.name}</span>` : ''}
                 ${isFocusTarget(config.name, config.iconID) ? targetIcon() : ''}
                 ${config.deep ? `<span>需${config.deep}步</span>` : ''}
                 ${config.nextUnClick ? `<span>${config.nextUnClick}</span>` : ''}
             </div>
             </div>`
 }

 function eachMatchedWord(tail, loop, func) {
     const array = pcr.DATA_MAP.head[tail];

     array.forEach(nextData => {
         if (loop > 1) {
             eachMatchedWord(nextData.tail, loop - 1, func);
         } else {
             func(nextData);
         }
     });
 }
 
 function eachMatchedWordHead(head, loop, func) {
     const array = pcr.DATA_MAP.tail[head];

     array.forEach(nextData => {
         if (loop > 1) {
             eachMatchedWordHead(nextData.head, loop - 1, func);
         } else {
             func(nextData);
         }
     });
 }

 // 如果删除成功返回true，不存在返回false
 function removeClickHistory(name, iconID) {
     if (pcr.clickHistory.delete(iconID + name)) {
         localStorage.setItem("clickedHistory", JSON.stringify(Array.from(pcr.clickHistory)));
         return true;
     }
     return false;
 }
 // 添加成功返回true，已存在返回false
 function addClickHistory(name, iconID) {
     if (isClicked(name, iconID)) return false;

     pcr.clickHistory.add(iconID + name);
     localStorage.setItem("clickedHistory", JSON.stringify(Array.from(pcr.clickHistory)));
     return true;
 }

 function isUnClicked(config) {
     return !isClicked(config.name, config.iconID);
 }

 function isClicked(name, iconID) {
     return pcr.clickHistory.has(iconID + name);
 }
 
 function isClickedByKey(key) {
     return pcr.clickHistory.has(key);
 }

 function targetIcon() {
     return '<svg t="1583303562466" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2566" width="32" height="32" style="position:absolute;right:20px;bottom:20px;">\<path d="M862.08 480A350.08 350.08 0 0 0 544 161.92V64h-64v97.92A350.08 350.08 0 0 0 161.92 480H64v64h97.92a350.08 350.08 0 0 0 318.08 318.08V960h64v-97.92a350.08 350.08 0 0 0 318.08-318.08H960v-64h-97.92zM480 798.08A287.232 287.232 0 0 1 225.92 544H480v254.08z m0-318.08H225.92A287.232 287.232 0 0 1 480 225.92V480z m64-254.08c133.76 14.72 239.36 120.32 254.08 254.08H544V225.92z m0 572.16V544h254.08a287.232 287.232 0 0 1-254.08 254.08z" p-id="2567"></path></svg>';
 }