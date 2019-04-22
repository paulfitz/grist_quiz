/**
 *
 * Expects:
 * Table called Quiz
 * With columns called:
 *   - hint
 *   - answer
 *
 */

var $$ = document.getElementById.bind(document);
var activeStanza = null;
var activeIndex = null;
var readyToMoveOn = false;
var order = [];
var at = -1;
var missed = [];
var scores = [];
var wantMissed = false;
var dictionary = [];

/**
 * Get the URL parameters
 * source: https://css-tricks.com/snippets/javascript/get-url-variables/
 * @param  {String} url The URL
 * @return {Object}     The URL parameters
 */
var getParams = function (url) {
	var params = {};
	var parser = document.createElement('a');
	parser.href = url;
	var query = parser.search.substring(1);
	var vars = query.split('&');
	for (var i = 0; i < vars.length; i++) {
		var pair = vars[i].split('=');
		params[pair[0]] = decodeURIComponent(pair[1]);
	}
	return params;
};

function strip(txt) {
   var doc = new DOMParser().parseFromString(txt, 'text/html');
   return doc.body.textContent || "";
}

var params = getParams(window.location);
var fromKey = params.from || 'hint';
var toKey = params.to || 'answer';
var selectKey = params.select;

function populateStorage() {
  activeIndex = null;
  order = [];
  at = -1;
  missed = [];
  for (var i=0; i<dictionary.length; i++) {
    order.push(i);
  }
  shuffle(order);
  localStorage.setItem('order', JSON.stringify(order));
  saveToStorage();
  localStorage.setItem('quiz2', 'ready');
}

function loadFromStorage() {
  order = JSON.parse(localStorage.getItem('order'));
  at = JSON.parse(localStorage.getItem('at'));
  missed = JSON.parse(localStorage.getItem('missed'));
}

function saveToStorage() {
  localStorage.setItem('at', JSON.stringify(at));
  localStorage.setItem('missed', JSON.stringify(missed));
}

if(!localStorage.getItem('quiz2')) {
  populateStorage();
} else {
  loadFromStorage();
}

// from https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;
  while (0 !== currentIndex) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }
  return array;
}

function playAudio() {
  // no audio in this quiz anymore...
  $$('guess').focus();
}

function fraction(x,y) {
  return '<div class="frac">' +
    '<span>' + x + '</span>' +
    '<span class="symbol">/</span>' +
    '<span class="bottom">' + y + '</span>' +
    '</div>';
}

function percent(f) {
  var txt = Math.round(f * 100);
  return txt + "%";
}

function averageScore(len) {
  var total = 0;
  var ct = Math.min(len, scores.length);
  for (var i=0; i<ct; i++) {
    total += scores[i] ? 1 : 0;
  }
  return fraction(total, ct) + " (" + percent(total/ct) + ")";
}

function updateScore(hit) {
  scores.unshift(hit);
  var recentAverage = averageScore(20);
  var longerTermAverage = averageScore(100);
  var ave = recentAverage;
  if (longerTermAverage !== recentAverage) {
    ave = recentAverage + " " + longerTermAverage;
  }
  $$('score').innerHTML = ave;
}

function addToMissed() {
  if (activeIndex !== null) {
    if (missed.length === 0 || missed[missed.length - 1] !== activeIndex) {
      missed.push(activeIndex);
      saveToStorage();
    }
    updateScore(false);
  }
  activeIndex = null;
}

function addToHit() {
  if (activeIndex !== null) {
    updateScore(true);
  }
  activeIndex = null;
}

function checkGuess() {
  var guess = $$('guess').value;
  console.log("GUESS IS", guess);
  if (!guess) {
    playAudio();
    return;
  }
  console.log(guess, activeStanza);
  if (guess.toLowerCase() === activeStanza.word.toLowerCase()) {
    if (readyToMoveOn) {
      moveOn();
      return;
    }
    console.log("RIGHT!");
    $$('guess').classList.add('correct');
    $$('everything').classList.add('correct');
    $$('answer').innerHTML = "woohoo!";
    $$('diff').innerHTML = "you got it!";
    readyToMoveOn = true;
    addToHit();
  } else {
    console.log("NOPE...");
    $$('answer').textContent = activeStanza.word;
    $$('guess').classList.remove('correct');
    $$('everything').classList.remove('correct');
    // var dmp = new diff_match_patch();
    // var d = dmp.diff_main(guess, activeStanza.word);
    // var ds = dmp.diff_prettyHtml(d);
    // $$('diff').innerHTML = ds;
    $$('guess').focus();
    addToMissed();
  }
}

function censor(txt, word) {
  // var pattern = new RegExp(word, 'ig');  // hopefully word has no funny letters...
  // return txt.replace(pattern, '<b>*****</b>');
  return txt;
}

function fillCard(stanza) {
  activeStanza = stanza;
  readyToMoveOn = false;
  $$('guess').value = "";
  $$('guess').classList.remove('correct');
  $$('everything').classList.remove('correct');
  $$('answer').innerHTML = "";
  $$('diff').innerHTML = "";
  $$('prompt').textContent =
    "What is the " + toKey + " for this?";
  $$('desc').textContent = censor(stanza.desc, stanza.word);
  // $$('pos').innerHTML = stanza.pos;
  // $$('audio_src').src = stanza.audio;
  $$('guess').focus();
  // $$('audio_sample').load();
  // $$('audio_sample').play().catch(function(e) {
  //   console.log("Play:", e);
  // });
  showMore(true);
  $$('excess').style.display = 'none';
  $$('regular').style.display = 'inline';
  saveToStorage();
}

function showMore(score) {
  score = score || ($$('excess').style.display !== 'none');
  if (score) {
    $$('excess').style.display = 'none';
    $$('regular').style.display = 'inline';
  } else {
    $$('excess').style.display = 'inline';
    $$('regular').style.display = 'none';
  }
}

function start() {
  grist.ready();
  var api = grist.rpc.getStub("GristDocAPI@grist", grist.checkers.GristDocAPI);
  api.fetchTable('Quiz')
    .then(function(quiz) {
      console.log(quiz);
      dictionary = [];
      console.log("KEYS", fromKey, toKey, selectKey);
      for (var i = 0; i < quiz.id.length; i++) {
        if (selectKey) {
          if (!quiz[selectKey][i]) { continue; }
        }
        dictionary.push({
          word: quiz[toKey][i],
          desc: quiz[fromKey][i]
        });
      }
      $$('guess').setAttribute('placeholder', toKey);
      reshuffle();
    });
}

function moveOn() {
  addToMissed();
  $$('card').style.display = 'block';
  $$('intro').style.display = 'none';
  var idx = null;
  if (wantMissed) {
    if (missed.length === 0) {
      alert("No missed words to do");
      return;
    }
    idx = missed.shift();
  } else {
    at += 1;
    if (at >= order.length) {
      alert("You did all the things!!!");
      return;
    }
    idx = order[at];
  }
  activeIndex = idx;
  fillCard(dictionary[activeIndex]);
}

function doMissed(cb) {
  activeIndex = null;
  wantMissed = cb.checked;
  moveOn();
}

function reshuffle() {
  populateStorage();
  moveOn();
}

function ready(fn) {
  if (document.attachEvent ? document.readyState === "complete" : document.readyState !== "loading"){
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

ready(start);

