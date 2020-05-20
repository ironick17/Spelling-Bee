/**
 * index.js
 * - All our useful JS goes here, awesome!
 **/

// Declare global variables. Will intialize them in a setup function.
// I probably should wrap this whole thing in a closure so I don't
// pollute the namespace of the browser. I should also just turn all
// these global varibles into properties of an object referenced
// through a single global variable.

// Flag for playing a game using an old NY Times HTML string.
var debugMode;

// NY Times game data for the day.
var gameData;

/**
 * This section is declaring
 * the variables that constitue the game state
 * that is saved across instances of playing.
 */
// Words we are guessing.
var gameAnswers;

// Words that are pangrams (also appear in gameAnswers).
var gamePangrams;

// Max possible score for the puzzle.
var maxScore;

// Array of game rankings/levels.
var gameLevels;

// List of optional letters.
var outerLetters;

// The one required letter.
var centerLetter;

// List of words guessed so far.
var answerList;

// Current score.
var gameScore;

// Current rank.
var gameRank;

var gameWeekday;

var gameDate;

// This is an object containing all of the information that needs to be saved in order
// to resume a game.
var gameState;

/**
 * End of section declaring
 * the variables that constitue the game state
 * that is saved across instances of playing.
 */

// This is the millisecond time when the game was last saved (locally or in the cloud).
var timestamp;

// List of buttons associated with the optional letters.
var outerLetterButtons;

// Where the currenct score appears on the page.
var gameScoreField;

// Where the current rank appears on the page.
var gameRankField;

// Where the current word being typed appears on the page.
var wordGuessField;

// The popup dialog box that displays various messages: score for correct word, all words found, duplicate word...
var submitPopupModal;

// How long the popup modal dialog box should display (in milliseconds).
var popupDisplayTime;

// Messages longer than this will display for popupDisplayTime * popupLongMsgMultiplier
var popupLongMsgLength;
var popupLongMsgMultiplier;

// This is the HTML element that appears at the start of a game.
var gameStartModal;

// The name of the person playing on this device. Used for saving and reloading games for different players.
var playerName;

// Guessed answers from yesterday's play.
var answerListYesterday;

// All answers from yesterday.
var gameAnswersYesterday;

/**
 * This app relies on getting information from the NY Times Spelling Bee via HTTP. I use the fetch function for this.
 * I also use fetch for accessing my json in the cloud at jsonbin.io.
 *
 * Since the fetch function is asynchronous function that returns a promise it took me quite a while to figure out JS promises.
 *
 * Here is a short description of how I currently think about JS promises:
 * I think a promise as a special kind of JS object or function. Usually to access the value of an object you simply use its name
 * in an expression, eg "let foo = myThing", and the access the result of a function you simply use its name followed by "()", eg
 * "let foo = myThing()". But with a promise, using its name in an expression is like using the name of a function NOT followed
 * by "()", all it does is access the function object itself, not invoke it for a  return value, eg "let foo = myFunction".
 * The ONLY way to access the value returned by a promise is to use the method ".then". This method isn't the typical accessor method, eg
 * "let foo = myThing.getValue", because the .then method actually takes a callback function as an argument. It is this callback
 * function that will be passed the value/result of the promise. What's cool about the .then method is that you can invoke it
 * on the promise whenever you want, eg even LONG AFTER the promise has been resolved. This is VERY different from a normal
 * function. With a normal function, you can only get its return result ONCE.
 *
 * At this point, I'll introduce the term "promissory". I call a function that is actually a promise a "promissory function" and
 * likewise for "promissory object". Thus, the cool thing about a promissory function is that its result can be accessed at any
 * time during the excution of an application and at many different locations in different functions comprising the app. I
 * recently discovered that the official name for what I call a promissory, is a thennable: A thennable is an object that defines
 * a then method.
 *
 * One last insight. Promise chaining, which I use below, isn't anthing special. It just enables you to fire off a series of
 * async functions where the next function doesn't run until the previous one has resolved. An even bigger insight is that the
 * function passed as an argument to the .then method DOES NOT have to be asynch. Invoking the .then method returns a promise,
 * so the regular, synchronous function is now wrapped in a promise, so the only way to access its return value is to invoke
 * ITS .then method. This is the basis of .then chaining.
 **/

// Get the Spelling Bee webpage.
// fetch returns a promise wrapping a JS response object.
async function getSpellingBee() {
  return (
    fetch(
      'https://cors-anywhere.herokuapp.com/https://www.nytimes.com/puzzles/spelling-bee'
      // The webpage comes back as a JS response object, so covert it before returning it.
    )
      // Note that this then method will return a new promise, since the .text method
      // of a response object returns a promise.
      .then((response) => response.text())
      // Even this catch returns a promise, because a all catches are just thens, and thens
      // wrap their return results in a promise.
      .catch((reason) => {
        alert(`Error: Can't get NY Times data: ${reason}`);
        debugMode = true;
        return nytimesHTMLText;
      })
  );
}

// The the string representing the webpage (HTML source) into DOM object so we can call HTML/DOM methods on it.
function parseSpellingBee(htmlText) {
  if (!htmlText.includes('<!DOCTYPE html>')) {
    alert(
      "Error: Can't parse NY Times data./nUsing old NY Times data for debugging."
    );
    debugMode = true;
    htmlText = nytimesHTMLText;
  }
  let parser = new DOMParser();
  return parser.parseFromString(htmlText, 'text/html');
}

function getGameInfo(htmlTree) {
  let gameData;
  let scripts = Array.from(htmlTree.getElementsByTagName('script'));
  scripts.some((script) => {
    let text = script.innerText;
    let pos = text.search('window.gameData = {');
    if (0 <= pos && pos < 10) {
      gameData = JSON.parse(text.substring(text.search('{')));
      return true;
    }
    return false;
  });
  return {
    gameData: gameData,
    gameLevels: [
      ['Beginner', 0],
      ['Good Start', 2],
      ['Moving Up', 5],
      ['Good', 8],
      ['Solid', 15],
      ['Nice', 25],
      ['Great', 40],
      ['Amazing', 50],
      ['Genius', 70],
    ],
  };
}

function setupGame(gameInfo) {
  try {
    // This reload is primarily so that I can get yesterday's guessed answers.
    reloadGameClient();
    /**
     * Begin initializing all gameState global variables
     */
    gameData = gameInfo.gameData.today;
    gameAnswers = gameData.answers.map((letter) => letter.toUpperCase());
    gameAnswersYesterday = gameInfo.gameData.yesterday.answers.map((letter) =>
      letter.toUpperCase()
    );
    gameAnswers.forEach((answer) => {
      maxScore += answer.length < 5 ? 1 : answer.length;
    });
    gamePangrams = gameData.pangrams.map((letter) => letter.toUpperCase());
    maxScore = 7; // Initialize to the pangram bonus amount.
    gameLevels = gameInfo.gameLevels.map((level) => [
      level[0],
      Math.round((level[1] / 100) * maxScore),
    ]);
    outerLetters = gameData.outerLetters.map((letter) => letter.toUpperCase());
    centerLetter = gameData.centerLetter.toUpperCase();
    answerListYesterday = [];
    let yesterday = new Date();
    yesterday.setHours(0, 0, 0, 0);
    yesterday.setDate(new Date().getDate() - 1);
    if (gameDate && new Date(gameDate).getTime() == yesterday.getTime()) {
      answerListYesterday = answerList || [];
    }
    answerList = [];
    gameScore = 0;
    gameRank = '';
    gameWeekday = gameData.displayWeekday;
    gameDate = gameData.displayDate;
    timestamp = Date.now();
    /**
     * End initializing all gameState global variables.
     */
  } catch (error) {
    alert(
      'Error: NY Times window.gameData structure changed.\nUsing old NY Times data for debugging.'
    );
    debugMode = true;
    setupGame(getGameInfo(parseSpellingBee(nytimesHTMLText)));
  }
}

function initGameHooks() {
  gameScoreField.value = gameScore;
  gameRankField.value = gameRank;
  rotateLetters(outerLetterButtons);
  changeBtnLtr(document.querySelector('.centerLetter'), centerLetter);
  displayAnswerList(answerList);
  let header = `${playerName[0].toUpperCase()}${playerName.slice(1)}'s ${
    document.getElementById('gameHeader').innerText
  } ${debugMode ? 'DEBUG MODE' : `${gameWeekday}, ${gameDate}`}`;
  document.getElementById('gameHeader').innerText = header;
  gameStartModal.style.visibility = 'hidden';
}

function selectLetter() {
  wordGuessField.value += this.innerText;
}

function deleteHandler() {
  wordGuessField.value = wordGuessField.value.slice(0, -1);
}

function submitHandler() {
  let guess = wordGuessField.value;
  let points = guessValue(guess);
  wordGuessField.value = '';
  if (points == 0) {
    displayModal('Not in word list');
    return;
  } else if (points == -1) {
    displayModal('Already found');
    return;
  }
  displayModal(points).then((result) => {
    if (updateProgress(guess, Math.abs(points)))
      displayModal('You found them all!');
    saveGameClient();
  });
}

function showRankingInfo() {
  let heading = '<h3 id="levelsHdr">Game Levels</h3>\n';
  let lines = gameLevels.map((level) => `<p>${level[0]} (${level[1]})</p>`);
  displayModal(heading + lines.join('\n'));
}

function showYesterdayAnswers() {
  let heading = `<h3 id="yesterdayHdr">Yesterday's Answers</h3>\n`;
  let lines = gameAnswersYesterday.map(
    (answer) =>
      `<p>${
        answerListYesterday.includes(answer) ? '*&nbsp;' : '&nbsp;&nbsp;&nbsp;'
      }${answer}</p>`
  );
  displayModal(heading + lines.join('\n'));
}

function rotateHandler() {
  rotateLetters(outerLetterButtons);
}

function changeBtnLtr(ltrButton, Ltr) {
  ltrButton.innerText = Ltr;
}

function mapBtnLtr(ltrButton, index) {
  changeBtnLtr(ltrButton, outerLetters[index]);
}

function rotateLetters(ltrButtonArr) {
  ltrButtonArr.forEach(mapBtnLtr);
  outerLetters.unshift(outerLetters.pop());
}

function displayModal(message) {
  if (typeof message == 'number') {
    message =
      (message < 0
        ? 'Pangram!'
        : 7 <= message
        ? 'Awesome!'
        : 1 < message
        ? 'Nice!'
        : 'Good!') +
      ' +' +
      Math.abs(message);
  }
  return new Promise((resolve) => {
    submitPopupModal.innerHTML = message;
    submitPopupModal.style.visibility = 'visible';
    setTimeout(() => {
      submitPopupModal.style.visibility = 'hidden';
      resolve('closed');
    }, popupDisplayTime * (message.length > popupLongMsgLength ? popupLongMsgMultiplier : 1));
  });
}

function guessValue(word) {
  let value = 0;
  if (answerList.includes(word)) {
    return -1;
  }
  if (gameAnswers.includes(word)) {
    if (word.length < 5) {
      value = 1;
    } else {
      value = word.length;
    }
  }
  if (gamePangrams.includes(word)) {
    value = -7 - value;
  }
  return value;
}

function updateProgress(word, points) {
  gameScore = parseInt(gameScoreField.value) + points;
  gameScoreField.value = gameScore;
  gameRankField.value = getRank(gameScore);
  answerList.push(word);
  answerList.sort();
  displayAnswerList(answerList);
  return answerList.length == gameAnswers.length;
}

function displayAnswerList(answerList) {
  let listHTML = document.createElement('ol');
  answerList.forEach((word) => {
    let li = document.createElement('li');
    listHTML.appendChild(li);
    li.innerHTML = word;
  });
  document.getElementById('answerList').firstChild.replaceWith(listHTML);
}

function getRank(score) {
  let rank;
  gameLevels.some((level, idx, arr) => {
    if (level[1] > score) {
      rank = arr[idx - 1][0];
      return true;
    } else return false;
  });
  gameRank = rank ? rank : gameLevels.slice(-1)[0][0];
  return gameRank;
}

function saveGameClient() {
  gameState = {
    gameAnswers,
    gamePangrams,
    maxScore,
    gameLevels,
    outerLetters,
    centerLetter,
    answerList,
    gameScore,
    gameRank,
    gameWeekday,
    gameDate,
    timestamp: Date.now(),
  };
  localStorage.gameState = JSON.stringify(gameState);
}

function updateCloudData(cloudData) {
  // Need to handle Cancel button differently. ?????
  if (cloudData == {}) {
    alert('Error: Cloud data not found. Reinitializing.');
    cloudData = {};
  }
  if (!cloudData.hasOwnProperty('spellingBee')) {
    alert('Error: Cloud data not found. Reinitializing.');
    cloudData.spellingBee = {};
  }
  if (!cloudData.spellingBee.hasOwnProperty(playerName)) {
    cloudData.spellingBee[playerName] = {};
  }
  cloudData.spellingBee[playerName].gameState = gameState;
  return cloudData;
}

async function setCloudData(cloudData) {
  let cloudDataString = JSON.stringify(cloudData);
  return fetch('https://api.jsonbin.io/b/5ebd62b88284f36af7bb1d7b', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'secret-key':
        '$2b$10$oenHkCkZSs3jpqzXIrl1LeITtaIoYXUBb96HvsRv5vC3Jf4cIVqvy',
    },
    body: cloudDataString,
  })
    .then(async (response) => {
      let responseJSON = response.json();
      return responseJSON.then((response) => response.success);
    })
    .catch((reason) => {
      alert(`Error: Can't store JSONbin.io data: ${reason}`);
      return false;
    });
}

function saveHandler() {
  this.style.backgroundColor = 'gray';
  saveGameCloud().then((response) => {
    displayModal(
      response
        ? 'Game saved!'
        : 'Game saved locally, but failed to save to cloud.'
    );
    this.style.backgroundColor = 'white';
  });
}

async function saveGameCloud() {
  saveGameClient();
  return getCloudData().then(updateCloudData).then(setCloudData);
}

function reloadGameClient() {
  let gameStateLocal = localStorage.gameState;
  if (gameStateLocal == undefined) return {};
  gameStateLocal = JSON.parse(gameStateLocal);
  ({
    gameAnswers,
    gamePangrams,
    maxScore,
    gameLevels,
    outerLetters,
    centerLetter,
    answerList,
    gameScore,
    gameRank,
    gameWeekday,
    gameDate,
    timestamp,
  } = gameStateLocal);
  return gameStateLocal;
}

function getCloudData() {
  return fetch('https://api.jsonbin.io/b/5ebd62b88284f36af7bb1d7b/latest', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'secret-key':
        '$2b$10$oenHkCkZSs3jpqzXIrl1LeITtaIoYXUBb96HvsRv5vC3Jf4cIVqvy',
    },
  })
    .then((response) => response.json())
    .catch((reason) => {
      alert(`Error: Can't get JSONbin.io data: ${reason}`);
      // this catch returns a promise whose resolution value is {}
      return {};
    });
}

function reloadGameCloud(cloudData) {
  let gameState = reloadGameClient();
  let spellingBeeData = cloudData.spellingBee || {};
  let gameStateCloud = (spellingBeeData[playerName] || {}).gameState;
  if (gameStateCloud == undefined) {
    if (gameState == {}) {
      return false;
    }
    alert(
      'Warning: No Spelling Bee Game State stored in cloud.\nUsing local saved state instead.'
    );
    return true;
  }
  let gameStateDateCloud = new Date(gameStateCloud.gameDate);
  let gameStateDateLocal = new Date(gameDate);
  if (gameStateDateCloud.getTime() < gameStateDateLocal.getTime()) {
    // The cloud data is for a previous day, so use local data.
    return true;
  }
  // Cloud state could be older than the state on this device if the player initially selected New Gam
  // on this device, then realized they had already played on another device and had gotten further.
  // So they refreshed the game page and selected Reload Game to get the other device's state stored
  // in the cloud.
  if (
    timestamp &&
    timestamp > gameStateCloud.timestamp &&
    !confirm(
      'Warning: Game state saved to cloud is older than local saved state.\nUse cloud saved state?'
    )
  )
    return true;
  ({
    gameAnswers,
    gamePangrams,
    maxScore,
    gameLevels,
    outerLetters,
    centerLetter,
    answerList,
    gameScore,
    gameRank,
    gameWeekday,
    gameDate,
    timestamp,
  } = gameStateCloud);
  gameState = gameStateCloud;
  return true;
}

function prepareGame(htmlString) {
  return setupGame(getGameInfo(parseSpellingBee(htmlString)));
}

function gameStart(startAction) {
  debugMode = false;
  playerName = document.getElementById('playerInputField').value || 'anonymous';
  let gamePromise;
  switch (startAction) {
    case 'Reload Game':
      gamePromise = getCloudData().then((cloudData) => {
        if (!reloadGameCloud(cloudData)) {
          alert('Warning: No cloud or local saved state.\nStarting new game.');
          prepareGame(nytimesHTMLText);
        }
      });
      break;
    case 'New Game':
      gamePromise = getSpellingBee().then(prepareGame);
      break;
    case 'Debug Game':
      gamePromise = Promise.resolve(prepareGame(nytimesHTMLText));
      debugMode = true;
  }
  gamePromise.then(() => initGameHooks());
}

function dialogBtnHandler() {
  // For some reason innerText = "", so I'm using innerHTML.
  this.style.backgroundColor = 'gray';
  gameStart(this.innerHTML);
}

/**
 * End of declarations (above), and beginning of execution.
 */

// Turn some of these into consts. ?????
popupDisplayTime = 1000;
popupLongMsgLength = 25;
popupLongMsgMultiplier = 3;
outerLetterButtons = Array.from(document.querySelectorAll('.outerLetter')).sort(
  (a, b) => a.innerText[1] - b.innerText[1]
);
wordGuessField = document.getElementById('wordGuessField');
gameScoreField = document.getElementById('gameScoreField');

gameRankField = document.getElementById('gameRankField');

submitPopupModal = document.getElementById('submitPopup');
document.getElementById('submit').onclick = submitHandler;
document.getElementById('delete').onclick = deleteHandler;
document.getElementById('rotate').onclick = rotateHandler;
document.getElementById('save').onclick = saveHandler;
document.querySelectorAll('.outerLetter').forEach((aButton) => {
  aButton.onclick = selectLetter;
});
document.querySelector('.centerLetter').onclick = selectLetter;
document.getElementById('gameRankLabel').onclick = showRankingInfo;
document.getElementById('answersHdr').onclick = showYesterdayAnswers;
document.querySelectorAll('.dialogBtn').forEach((aButton) => {
  aButton.onclick = dialogBtnHandler;
});
gameStartModal = document.getElementById('gameStart');
