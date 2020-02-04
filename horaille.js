const ical = require('ical');
const api = require('termux-api').default;
const conf = require('./config.json');
 
function notifyAndQuitIfConfErrors() {
    const booleanSettings = ["useURL", "repeat"]
    const booleanSubsettings = ["notification", "text-to-speech"]
    const stringSettings = {
        "name":/^([A-ÿ]|\s)+$/gm,   // any number of words containing letters
        "lang":/^(FR|EN)$/,         // either purely "FR" or "EN"
        "URL":/(?:(?:https?|ftp|file):\/\/|www\.|ftp\.)(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[-A-Z0-9+&@#\/%=~_|$?!:,.])*(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[A-Z0-9+&@#\/%=~_|$])/gim,
        "calendarname":/^[A-ÿ]+\.ics$/
    }
    for (let settingName in conf) {
        if (conf.hasOwnProperty(settingName)) {
            var settingValue = conf[settingName];
            if (settingName in booleanSettings) {
                if (typeof settingValue !== "boolean") {
                    throw settingName + " must be either true or false";
                }
            }
            else if (settingName in booleanSubSettings) {
                for (let subsettingName in settingValue) {
                    if (settingValue.hasOwnProperty(subsettingName)) {
                    var subsettingValue = settingValue[subsettingName];
                        if (typeof settingValue !== "boolean") {
                            throw subsettingName + " of " + settingName + " must be either true or false";
                        }
                    }
                }
            }
            else if (settingName in stringSettings) {
                if (!stringSettings[settingName].test(settingValue)) {
                    throw "Invalid input for the setting " + settingName
                }
            }
        }
    }
}
notifyAndQuitIfConfErrors();


function termux-tts-speak(toSay) {
    api.createCommand()
        .ttsSpeak()
        .setTextToSpeak(toSay)
        .build()
        .run();
}


function isItToday(inputDate) {
    // Copying inputDate to later setHours to 0
    // without affecting the original inputDate
    inputDate = new Date(inputDate.toGMTString())
    
    var todaysDate = new Date();

    // call setHours to take the time out of the comparison
    return (inputDate.setHours(0,0,0,0) == todaysDate.setHours(0,0,0,0))
}


// This function is helpful in the calendar-reading loop to 
// prevent going further down the calendar file than needed
function isItInTheFuture(inputDate) {
    // Copying inputDate to later setHours to 0
    // without affecting the original inputDate
    inputDate = new Date(inputDate.toGMTString())
    var todaysDate = new Date();
    // call setHours to take the time out of the comparison
    return (inputDate.setHours(0,0,0,0) > todaysDate.setHours(0,0,0,0))
}


function getReadableDate() {
    let days = {
        "FR":["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"],
        "EN":["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    };
    let months = {
        "FR":["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
        "EN":["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    };
    var date = new Date();
    let today = days[conf.lang][date.getDay()] + " " + date.getDate() + " " + months[conf.lang][date.getMonth()] + " " + date.getFullYear();
    return today;
}


function getGreetings() {
    if (conf.lang === "FR") {
        return `Bonjour ${conf.name}, nous sommes le ${getReadableDate()} et voici l'horaire d'aujourd'hui\n`
    }
    else if (conf.lang === "EN") {
        return `Good morning ${conf.name}, it is the ${getReadableDate()} and here is today's schedule\n`
    }
}

// This block of code needs to be broken down and refactored
ical.fromURL(conf.URL, {}, function(err, data) {
    let horaireTTS = ""

    for (let k in data) {
        if (data.hasOwnProperty(k)) {
            var ev = data[k];
            if (data[k].type == 'VEVENT') {
                if (isItToday(ev.start)) {
                    paddedMinutes = ev.start.getMinutes().toString().padStart(2, "0");
                    horaireTTS += `${ev.summary} à ${ev.start.getHours()}h${paddedMinutes}` 
                    + (conf.sayLocation ? ` au ${ev.location}` : '') + '\n'; 
                    console.log(`${ev.summary} à ${ev.start.getHours()}h${paddedMinutes}`
                    + (conf.printLocation ? ` au ${ev.location}` : '') + '\n'); 

                }
                else if (isItInTheFuture(ev.start)) {
                    break;
                }
            }
        }
    } // End of loop through calendar events
    if (conf.repeat) {
        horaireTTS += "Je répète\n" +  horaireTTS;
    }
    termux-tts-speak(greetings + horaireTTS)
});
