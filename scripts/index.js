/**
 * index.js
 * - All our useful JS goes here, awesome!
 **/

/**
 *
 *
 *
 *
 *
 * This section declares global variables. I will
 * intialize them later in a setup function. I probably should wrap this whole thing
 * in a closure so I don't pollute the namespace of the browser. I should also
 * just turn all these global varibles into properties of an object referenced
 * through a single global variable. eg gameState.
 *
 */

// Flag for playing a game using an old NY Times HTML string.
// The flag isn't really used for anything other than initializing
// the main app header to put "DEBUGMODE" in the header. I
// suppose it is useful to check in the console to see if something
// went wrong.
var debugMode;

// NY Times game data for the day. Not to be confused with the
// variable gameState, which references an object containing the
// state of play as saved locally and/or in the cloud.
var gameData;

/**
 * This subsection declares the variables that constitue the game state that is
 * saved across instances of playing.
 **/

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

// The day of the week, eg monday, tuesday
var gameWeekday;

// The (string) date, eg "May 18, 2020"
var gameDate;

// This is an object containing all of the information that needs to be saved in order
// to resume a game.
var gameState;

// This is the millisecond time when the game was last saved (locally or in the cloud).
var timestamp;

/**
 * This subsection declares the remaining global variables.
 **/

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
 *
 *
 *
 *
 *
 * This section of function declarations defines the functions used to load and
 * initialize the game in different modes (reload, new, debug).
 */

/**
 * This app relies on getting information from the NY Times Spelling Bee via
 * HTTP. I use the fetch function for this. I also use fetch for accessing my
 * json in the cloud at jsonbin.io.
 *
 * Since the fetch function is asynchronous function that returns a promise it
 * took me quite a while to figure out JS promises.
 *
 * Here is a short description of how I currently think about JS promises: I
 * think a promise as a special kind of JS object or function. Usually to access
 * the value of an object you simply use its name in an expression, eg "let foo
 * = myThing", and the access the result of a function you simply use its name
 * followed by "()", eg "let foo = myThing()". But with a promise, using its
 * name in an expression is like using the name of a function NOT followed by
 * "()", all it does is access the function object itself, not invoke it for a
 * return value, eg "let foo = myFunction". The ONLY way to access the value
 * returned by a promise is to use the method ".then". This method isn't the
 * typical accessor method, eg "let foo = myThing.getValue", because the .then
 * method actually takes a callback function as an argument. It is this callback
 * function that will be passed the value/result of the promise. What's cool
 * about the .then method is that you can invoke it on the promise whenever you
 * want, eg even LONG AFTER the promise has been resolved. This is VERY
 * different from a normal function. With a normal function, you can only get
 * its return result ONCE.
 *
 * At this point, I'll introduce the term "promissory". I call a function that
 * is actually a promise a "promissory function" and likewise for "promissory
 * object". Thus, the cool thing about a promissory function is that its result
 * can be accessed at any time during the excution of an application and at many
 * different locations in different functions comprising the app. I recently
 * discovered that the official name for what I call a promissory, is a
 * thennable: A thennable is an object that defines a then method.
 *
 * One last insight. Promise chaining, which I use below, isn't anthing special.
 * It just enables you to fire off a series of async functions where the next
 * function doesn't run until the previous one has resolved. An even bigger
 * insight is that the function passed as an argument to the .then method DOES
 * NOT have to be asynch. Invoking the .then method returns a promise, so the
 * regular, synchronous function is now wrapped in a promise, so the only way to
 * access its return value is to invoke ITS .then method. This is the basis of
 * .then chaining.
 **/

// Get the Spelling Bee webpage.
// If anything goes wrong, return our canned NY Times HTML string.
// I use an http proxy (...herokuapp.com) to get around the cors (cross-origin requests)
// problem.
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

// Parse the  string representing the webpage (HTML source) into document object so we can call HTML/DOM methods on it.
function parseSpellingBee(htmlText) {
  // If we can't find this substring, then we got back gibberish from the NY Times website.
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

// Look for the script element in the document where the assignment of the gameData JSON object occurs,
// then get the string representation of that object and parse it into a real JSON object.
// Return an object containing both the game data from the NY Times web page and an array
// representing the percentages of the max score mapped to each rank name.
// Originally I was going to get the gameLevels from the website, but they are in a JS
// file, not the HTML page.
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

// This initializes all the gameState global variables.
function setupGame(gameInfo) {
  try {
    // This reload is primarily so that I can get yesterday's guessed answers.
    reloadGameClient();
    /**
     * Begin initializing all gameState global variables
     */
    gameData = gameInfo.gameData.today;
    // We store/display all game letters and words in uppercase.
    gameAnswers = gameData.answers.map((letter) => letter.toUpperCase());
    // Calculate the maximum possible score so we can calculate
    // rank levels.
    maxScore = 7;
    gameAnswers.forEach((answer) => {
      maxScore += answer.length < 5 ? 1 : answer.length;
    });
    gamePangrams = gameData.pangrams.map((letter) => letter.toUpperCase());
    // Use the pecentage in each rank level array to calculate the score
    // required to reach a given rank.
    gameLevels = gameInfo.gameLevels.map((level) => [
      level[0],
      Math.round((level[1] / 100) * maxScore),
    ]);
    outerLetters = shuffledArrayPermutations(
      gameData.outerLetters.map((letter) => letter.toUpperCase())
    );
    centerLetter = gameData.centerLetter.toUpperCase();
    // A simple hack to get the correct guesses from yesterday's play.
    // It's a hack because it doesn't work in the general case.
    // It gets yesterday's guesses from localStorage on this device,
    // not from the cloud.
    // Note that answerListYesterday is not one of the global variables
    // stored in gameState, but we initialize it in this section before
    // we reset answerList and gameDate.
    answerListYesterday = [];
    gameAnswersYesterday = [];
    let yesterday = new Date();
    yesterday.setHours(0, 0, 0, 0);
    yesterday.setDate(new Date().getDate() - 1);
    // If the global variable gameDate is defined and is yesterday's date, then the guesses
    // stored on this device are the correct guessed answers for yesterday.
    if (gameDate && new Date(gameDate).getTime() == yesterday.getTime()) {
      answerListYesterday = answerList || [];
      // Yesterday's game answers are only available when we start from a new
      // game or the canned game. If we start from a reload, this statement
      // is never reached.
      gameAnswersYesterday = gameInfo.gameData.yesterday.answers.map((letter) =>
        letter.toUpperCase()
      );
    }
    // Reset the answerList for today's game AFTER we copy it to answerListYesterday!
    answerList = [];
    // End of simple hack for yesterday's answers.
    gameScore = 0;
    gameRank = '';
    // Reset the weekday and date to the values from the NY Times webpage.
    gameWeekday = gameData.displayWeekday;
    gameDate = gameData.displayDate;
    // Stamp the time (though we set it again when saving to localStorage).
    timestamp = Date.now();
    /**
     * End initializing all gameState global variables.
     */
  } catch (error) {
    alert(
      `Error: NY Times window.gameData structure changed.\nUsing old NY Times data for debugging.
      Error message: ${error}`
    );
    debugMode = true;
    // Recurse using canned HTML text to start with.
    // Note that if the problem is not with the HTML but in the code
    // of setupGame, then this will cause an infitnite recursion.
    // This is a bit of a hack, but it's too hairy to fix for now.
    setupGame(getGameInfo(parseSpellingBee(nytimesHTMLText)));
  }
}

function shuffledArrayPermutations(arr) {
  return _.shuffle(getArrayMutations(arr));
}

function getArrayMutations(arr, perms = [], len = arr.length) {
  if (len === 1) perms.push(arr.slice(0));

  for (let i = 0; i < len; i++) {
    getArrayMutations(arr, perms, len - 1);

    len % 2 // parity dependent adjacent elements swap
      ? ([arr[0], arr[len - 1]] = [arr[len - 1], arr[0]])
      : ([arr[i], arr[len - 1]] = [arr[len - 1], arr[i]]);
  }

  return perms;
}

// I broke out this function so that when we load from the cloud/
// local, we only need to call this function. It reintializes everything
// from the current global variables representing gameState.
function initGameHooks() {
  gameScoreField.value = gameScore;
  gameRankField.value = gameRank;
  rotateLetters(outerLetterButtons);
  changeBtnLtr(document.querySelector('.centerLetter'), centerLetter);
  displayAnswerList(answerList);
  // The main game header uses the player name entered at the start
  // of the game. It uses "DEBUG MODE" instead of a date if the
  // game was started in debug mode.
  let header1 = `${playerName[0].toUpperCase()}${playerName.slice(1)}'s ${
    document.getElementById('gameHeader').innerText
  }`;
  let header2 = `${debugMode ? 'DEBUG MODE' : `${gameWeekday}, ${gameDate}`}`;
  document.getElementById('gameHeader').innerText = header1;
  document.getElementById('gameDateHdr').innerText = header2;
  gameStartModal.style.visibility = 'hidden';
}

// A little helper function for the wrapped calls to parse
// the HTML, get the JSON object out of it, and initialize
// the global gameState variables.
function prepareGame(htmlString) {
  return setupGame(getGameInfo(parseSpellingBee(htmlString)));
}

// This is the function that gets the whole game going. It
// starts the game in one of three modes:
// 1. Reloaded, using datA that was previously stored locally or in the cloud
// 2. A new game, using the game data from today's NY Times webpage.
// 3. Debug mode, using canned HTML (stored in a separate .js file).
function gameStart(startAction) {
  debugMode = false;
  playerName = document.getElementById('playerInputField').value || 'anonymous';
  //I learned a lot about JS promises doing this game. I found I was way
  // overusing .then methods. A .then method need only be applied to a promise
  // that is actually asynchronous. If you pass a synchronous function as the
  // argument of a .then method invocation, it is returned as a synchronous
  // promise.
  //
  // In each case statement I create a different promise, then when it drops
  // out of the case statement, I use .then to invoke initGameHooks when
  // gamePromise is resolved.
  let gamePromise;
  switch (startAction) {
    case 'Reload Game':
      // This is the only tricky promise. getCloudData is an async
      // function (it does an HTTP request). It's then method invokes only
      // sync functions: one to actually apply the data from the cloud,
      // and one to initialize with the canned HTML if anything goes wrong.
      gamePromise = getCloudData().then((cloudData) => {
        if (!reloadGameCloud(cloudData)) {
          alert('Warning: No cloud or local saved state.\nStarting new game.');
          prepareGame(nytimesHTMLText);
          debugMode = true;
        }
      });
      break;
    case 'New Game':
      // The core of the game. Get the data from NY Times website and
      // initialize a new state of game play with it.
      gamePromise = getSpellingBee().then(prepareGame);
      break;
    case 'Debug Game':
      // "Get" the NY Times website from an HTML string stored in
      // a different .js file. Note the use of .resolve. I don't
      // really need to wrap prepareGame in a promise, since it is
      // sync. But I do it so that all three cases can use the same
      // .then method below. In this case the gamePromise is already
      // resolved with the resolved value set to the value returned
      // by prepare game (which isn't used by initGameHooks).
      gamePromise = Promise.resolve(prepareGame(nytimesHTMLText));
      debugMode = true;
  }
  gamePromise.then(() => initGameHooks());
}

/**
 *
 *
 *
 *
 *
 * This section of function declarations defines functions used to
 * save and reload the state of game play.
 */

// One of the simplest functions in this app. Just bundle up the current
// values of the set of global variables representing the current state
// of play, and turn then into an object with a timestamp of now. Then
// store it in localStorage, which lasts as long as the browser "lasts".
function saveGameClient() {
  // The global variable gameState is updated with a new object
  // representing the state of play (ie the values of the set of
  // global variables representing the state of play) after every
  // corrent guess. It is also updated with saving to the cloud.
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

// I should probably rename this saveGame, because it ended up
// saving both locally and to the cloud. It would look like this:
//async function saveGame() {
//  saveGameClient();
//  return getCloudData().then((cloudData) => setCloudData(updateCloudData(cloudData)));
//}
// But I don't feel like working on the app any more. ?????

async function saveGameCloud() {
  // Saving to client is probably redundant since a local save
  // is done after every correct guess.
  saveGameClient();
  // I don't really need to chain updateCloudData because it
  // isn't an async function/it does not return a promise.
  return getCloudData().then(updateCloudData).then(setCloudData);
}

// Pretty simple way to store a javascript object in the cloud (in JSON notation).
// Note that jsonbin.io is free, so pretty rudimentary. Plus it limits you to
// 10K free HTTP requests on your bin (where the JSON string is stored),
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
      // The following });\n} was highlighted in red by the prettifier in VSCODE
      // but I don't know why. It seems fine now.
    });
}

// When everything is working right, if the player is say "Nick",
// this function simply replaces/initializes the value of
// cloudData.spellingBee.Nick.gameState with the current gameState.
// Everything else is handling exceptions.
// I am conservatively assuming that the cloudData object could
// be storing state for games/apps other than this spelling bee
// app, so I give this app its own "namespace" by using the "spellingBee"
// property.
function updateCloudData(cloudData) {
  if (_.isEqual(cloudData, {})) {
    alert('Error: Cloud data not found. Reinitializing.');
    cloudData = {};
  }
  if (!cloudData.hasOwnProperty('spellingBee')) {
    alert('Error: Cloud data not found. Reinitializing.');
    cloudData.spellingBee = {};
  }
  // Note we're future proofing the kinds of data that can
  // be stored for a player. Currently, the object returned
  // by cloudData.spellingBee[playerName] has only one property:
  // .gameState.
  if (!cloudData.spellingBee.hasOwnProperty(playerName)) {
    cloudData.spellingBee[playerName] = {};
  }
  // Note that we don't test whether the cloud gameState
  // has a more recent timestamp than the local timestamp.
  cloudData.spellingBee[playerName].gameState = gameState;
  return cloudData;
}

// I guess I should have called this the saveCloudData function.
// Note that by doing a PUT, I am completely replacing the value
// of the jsonbin.io bin. That's why I get its previous value and
// update it.
async function setCloudData(cloudData) {
  let cloudDataString = JSON.stringify(cloudData);
  return (
    fetch('https://api.jsonbin.io/b/5ebd62b88284f36af7bb1d7b', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'secret-key':
          '$2b$10$oenHkCkZSs3jpqzXIrl1LeITtaIoYXUBb96HvsRv5vC3Jf4cIVqvy',
      },
      body: cloudDataString,
    })
      // The jsonbin.io documentation says says the HTTP request returns
      // a JSON object with the property success, which is true if all
      // went well, and false otherwise.
      .then(async (response) => {
        let responseJSON = response.json();
        return responseJSON.then((response) => response.success);
      })
      // I should probably consolodate error handing instead of
      // just returning false if the value of the "success" property
      // is false. That kind of error is in the handling by jsonbin.io.
      // The catch error handing here deals with the HTTP request
      // process going wrong, eg site not available.
      .catch((reason) => {
        alert(`Error: Can't store JSONbin.io data: ${reason}`);
        return false;
      })
  );
}

// The inverse of saveGameClient, and pretty simple as well.
function reloadGameClient() {
  let gameStateStr = localStorage.gameState || '{}';
  // It is possible for this function to be called in a
  // browser that has not yet stored any game state.
  gameState = JSON.parse(gameStateStr);
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
  } = gameState);
}

function reloadGameCloud(cloudData) {
  reloadGameClient();
  let spellingBeeData = cloudData.spellingBee || {};
  let gameStateCloud = (spellingBeeData[playerName] || {}).gameState;
  // Was there a gameState stored in the cloud for this player?
  if (gameStateCloud == undefined) {
    if (_.isEmpty(gameState)) {
      // There is nothing locally or in the cloud to reload!
      return false;
    } else {
      // There was no gameState stored in the cloud,
      // but there is a local gameState. So we will use that.
      alert(
        'Warning: No Spelling Bee Game State stored in cloud.\nUsing local saved state of previous player instead.'
      );
      return true;
    }
    // If there is a cloud gameState but no local one, then
    // we can skip the following extra testing.
  } else if (!_.isEmpty(gameState)) {
    // There are so many different combinations comparing local gameDate/timestamp
    // to cloud it is mindnumbing! So I'm just going to do a single check:
    // Is the local timestamp greater than the cloud timestamp. If so, then
    // We will prompt to confirm. Otherwise, we just use the cloud gameState.
    if (
      timestamp > gameStateCloud.timestamp &&
      !confirm(
        'Warning: Game state saved to cloud is older than local saved state.\nUse cloud saved state?'
      )
    )
      return true;
  }
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

/**
 *
 *
 *
 *
 *
 * This section of function declarations defines functions to handle
 * clicks/presses and display information during game play
 */
function dialogBtnHandler() {
  // For some reason innerText = "", so I'm using innerHTML.
  this.style.backgroundColor = 'gray';
  gameStart(this.innerHTML);
}

function selectLetter() {
  wordGuessField.value += this.innerText;
}

function deleteHandler() {
  wordGuessField.value = wordGuessField.value.slice(0, -1);
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

function rotateLetters(ltrButtonArr) {
  ltrButtonArr.forEach(mapBtnLtr);
  outerLetters.unshift(outerLetters.pop());
}

function mapBtnLtr(ltrButton, index) {
  changeBtnLtr(ltrButton, outerLetters[0][index]);
}

function changeBtnLtr(ltrButton, Ltr) {
  ltrButton.innerText = Ltr;
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
    // Save the state of play locally after every correct guess.
    // So even if the device crashes, you don't lose your game.
    saveGameClient();
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

/**
 *
 *
 *
 *
 *
 * This FINAL section excutes various assigment
 * and initialization statements to begin game play. They are
 * not included in or setupGame or initGameHooks because they
 * are not related to the state of game play and they do not
 * need to be refreshed with each reload of the game. They
 * only need to be initialized once.
 */

// Turn some of these into consts. ?????
popupDisplayTime = 1000;
popupLongMsgLength = 25;
popupLongMsgMultiplier = 3;
// When the game is started with a reload, the saved state (gameState)
// doesn't store yesterday's answers. They are only retrieved from HTML
// when a new game is started. If a player clicks on "Score" after
// game is started from a reload, only the header will appear.
gameAnswersYesterday = [];
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
document.getElementById('gameScoreLabel').onclick = showYesterdayAnswers;
document.querySelectorAll('.dialogBtn').forEach((aButton) => {
  aButton.onclick = dialogBtnHandler;
});
gameStartModal = document.getElementById('gameStart');

/**
 *
 *
 *
 *
 *
 * END OF FLIE
 */
