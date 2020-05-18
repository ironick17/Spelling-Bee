/**
 * index.js
 * - All our useful JS goes here, awesome!
 **/

// Declare global variables. Will intialize them in a setup function.

// Flag for playing a game using an old NY Times HTML string.
var debugMode;

// NY Times game data for the day.
var gameData;

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

// List of buttons associated with the optional letters.
var outerLetterButtons;

// The one required letter.
var centerLetter;

// List of words guessed so far.
var answerList;

// Where the current word being typed appears on the page.
var wordGuessField;

// Current score.
var gameScore;

// Current rank.
var gameRank;

// Where the currenct score appears on the page.
var gameScoreField;

// Where the current rank appears on the page.
var gameRankField;

// The popup dialog box that displays various messages: score for correct word, all words found, duplicate word...
var submitPopupModal;

// How long the popup modal dialog box should display (in milliseconds).
var popupDisplayTime;

// Messages longer than this will display for popupDisplayTime * popupLongMsgMultiplier
var popupLongMsgLength;
var popupLongMsgMultiplier;

// This is the HTML element that appears at the start of a game.
var gameStartModal;

// This is an object containing all of the information that needs to be saved in order
// to resume a game.
var gameState;

// This is the millisecond time when the game was last saved (locally or in the cloud).
var timestamp;

/**
 * This section of functions are all invovled in getting information from the NY Times Spelling Bee and setting up this local game.
 * Since the fetch function is asynchronous (returns a promise), all but the last of these functions must be promises as well.
 *
 * Here is a short description of how I current think about JS promises:
 * I think a promise as a special kind of JS object or function. Usually to access the value of an object you simply use its name
 * in an expression, eg "let foo = myThing", and the access the result of a function you simply use its name followed by "()", eg
 * "let foo = myThing()". But with a promise, using its name in an expression is like using the name of a function NOT followed
 * by "()", all it does is access the function itself, not its return value, eg "let foo = myFunction".
 * The ONLY way to access the value of the promise is to use the method ".then". This method isn't the typical accessor method, eg
 * "let foo = myThing.getValue", because the .then method actually takes a callback function as an argument. It is this callback
 * function that will be passed the value/result of the promise. What's cool about the .then method is that you can invoke it
 * on the promise whenever you want, eg even LONG AFTER the promise has been resolved. This is VERY different from a normal
 * function. With a normal function, you can only get its return result ONCE.
 *
 * At this point, I'll introduce the term "promissory". I call a function that is actually a promise a "promissory function" and
 * likewise for "promissory object". Thus, the cool thing about a promissory function is that its result can be accessed at any
 * time during the excution of an application and at many different locations in different functions comprising the app.
 *
 * One last insight. Promise chaining, which I use below, isn't anthing special. It just enables you to fire off a series of
 * async functions where the next function doesn't run until the previous one has resolved.
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
        alert(`Error getting NY Times data: ${reason}`);
        debugMode = true;
        return nytimesHTMLText;
      })
  );
}

// The the string representing the webpage (HTML source) into  DOM object so we can call HTML/DOM methods on it.
// It returns a prom
function parseSpellingBee(htmlText) {
  return new Promise((resolve, reject) => {
    if (!htmlText.includes('<!DOCTYPE html>')) {
      alert(
        'Error parsing NY Times data. Using old NY Times data for debugging.'
      );
      debugMode = true;
      htmlText = nytimesHTMLText;
    }
    let parser = new DOMParser();
    resolve(parser.parseFromString(htmlText, 'text/html'));
  });
}

function getGameInfo(htmlTree) {
  return new Promise((resolve, reject) => {
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
    resolve({
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
    });
  });
}

function setupGame(gameInfo) {
  gameData = gameInfo.gameData.today;
  gameAnswers = gameData.answers.map((letter) => letter.toUpperCase());
  gamePangrams = gameData.pangrams.map((letter) => letter.toUpperCase());
  maxScore = 7;
  gameAnswers.forEach((answer) => {
    maxScore += answer.length < 5 ? 1 : answer.length;
  });
  gameLevels = gameInfo.gameLevels.map((level) => [
    level[0],
    Math.round((level[1] / 100) * maxScore),
  ]);
  outerLetters = gameData.outerLetters.map((letter) => letter.toUpperCase());
  centerLetter = gameData.centerLetter.toUpperCase();
  gameScore = 0;
  gameRank = '';
  maxScore = 7; // Initialize to the pangram bonus amount.
  answerList = [];
  gameWeekday = gameData.displayWeekday;
  gameDate = gameData.displayDate;
  initGameHooks();
}

function initGameHooks() {
  gameScoreField.value = gameScore;
  gameRankField.value = gameRank;
  rotateLetters(outerLetterButtons);
  changeBtnLtr(document.querySelector('.centerLetter'), centerLetter);
  displayAnswerList(answerList);
  document.getElementById('gameHeader').innerText += debugMode
    ? ' DEBUG MODE'
    : ` ${gameWeekday}, ${gameDate}`;
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

// INCOMPLETE FUNCTION. yesterdayMyAnswers not defined yet. ?????
function showYesterday() {
  let heading = `<h3 id="yesterdayHdr">Yesterday's Answers</h3>\n`;
  let lines = gameInfo.yesterday.answers.map(
    (answer) => `<p>${yesterdayMyAnswers.includes(answer) ? '*' : ''}answer</p>`
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
  return new Promise((resolve, reject) => {
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
  let saveName = prompt('Who is saving this game?', 'anonymous') || 'anonymous';
  if (cloudData == {}) {
    alert('Cloud data not found. Reinitializing.');
    cloudData = {};
  }
  if (!cloudData.hasOwnProperty('spellingBee')) {
    alert('Cloud data not found. Reinitializing.');
    cloudData.spellingBee = {};
  }
  if (!cloudData.spellingBee.hasOwnProperty(saveName)) {
    cloudData.spellingBee[saveName] = {};
  }
  cloudData.spellingBee[saveName].gameState = gameState;
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
      alert(`Error storing JSONbin.io data: ${reason}`);
      return false;
    });
}

function saveHandler() {
  saveGameCloud().then((response) =>
    displayModal(
      response
        ? 'Game saved!'
        : 'Game saved locally, but failed to save to cloud.'
    )
  );
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
      alert(`Error getting JSONbin.io data: ${reason}`);
      // this catch returns a promise whose resolution value is {}
      return {};
    });
}

function reloadGameCloud(cloudData) {
  let saveName = prompt('Who saved this game?', 'anonymous') || 'anonymous';
  let gameState = reloadGameClient();
  let spellingBeeData = cloudData.spellingBee || {};
  let gameStateCloud = (spellingBeeData[saveName] || {}).gameState;
  if (gameStateCloud == undefined) {
    if (gameState == {}) {
      return false;
    }
    alert(
      'No Spelling Bee Game State stored in cloud.\nUsing local saved state instead.'
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
      'Game state saved to cloud is older than local saved state.\nUse cloud saved state?'
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

function gameStart(startAction) {
  debugMode = false;
  // Add code to get player name at the beginning of the game.
  // With the name get cloud data and if it is from yesterday,
  // store yesterday's game state in a global variable that
  // can be used to show yesterday's results.
  // Also need to add code to save to cloud to save yesterday's
  // game state along with today's.
  switch (startAction) {
    case 'Reload Game':
      getCloudData().then((cloudData) => {
        if (reloadGameCloud(cloudData)) {
          initGameHooks();
        } else {
          alert('No cloud or local saved state.\nStarting new game.');
          getSpellingBee()
            .then(parseSpellingBee)
            .then(getGameInfo)
            .then(setupGame);
        }
      });
      break;
    case 'New Game':
      getSpellingBee().then(parseSpellingBee).then(getGameInfo).then(setupGame);
      break;
    case 'Debug Game':
      debugMode = true;
      parseSpellingBee(nytimesHTMLText).then(getGameInfo).then(setupGame);
  }
}

function dialogBtnHandler() {
  // For some reason innerText = "", so I'm using innerHTML.
  this.style.background = 'gray';
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
document.querySelectorAll('.dialogBtn').forEach((aButton) => {
  aButton.onclick = dialogBtnHandler;
});
gameStartModal = document.getElementById('gameStart');
