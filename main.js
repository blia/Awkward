var vorpal = require('vorpal');
var chalk = vorpal().chalk;
var _ = require('underscore');
var os = require('os');
var vm = require('vm');

var user = process.env.USER
if (os.platform() === "win32") {
  user = process.env.USERNAME
}

var awkward = vorpal()
  .delimiter(`${user}@awk`)
  .localStorage('awkward@iostreamer')
  .history('awkward@iostreamer/history');

global.chalk = chalk
global.awkward = awkward
global._ = _

// util

var log = function (obj) {
  awkward.log(chalk.yellow(obj));
}

var cliff = require ('cliff')

cliff.inspect = require('eyes').inspector({styles: {
  all:     'red',
  label:   'underline',
  other:   'inverted',
  key:     'bold',
  special: 'grey',
  string:  'green',
  number:  'magenta',
  bool:    'blue',
  regexp:  'green'
}})

var tryParseJSON = jsonString => {
  try {
    var o = JSON.parse(jsonString);
    if (o && typeof o === 'object') {
      return o;
    }
  } catch (e) {
    // awkward.log(e)
  }
  return false;
}

// terminal/structure

var getStructured = data => {
  var array = [];
  var json = tryParseJSON(data);
  if (json) {
    array.push(json);
    return array
  }
  lines = data.split('\n');
  lines = lines.filter(line => line.length > 0);
  lines.forEach(line => {
    var cleanedData = line.split(' ').filter(value => value != "");
    array.push(cleanedData);
  });

  return array;
}

// terminal/format

var displayFormatted = data => {
  var json = tryParseJSON(data);
  if (json) {
    awkward.log('')
    awkward.log(cliff.inspect(json))
    return;

  }

  var lines = data.split('\n');
  if(lines[1].length < 40) {
    var formatted_op = [];
    var step = 10;
    while (lines.length) {
      formatted_op.push(lines.splice(0,step))
    }
    formatted_op = _.zip.apply(_, formatted_op.map(a => _.compact(a)));

    awkward.log ('')
    awkward.log (cliff.stringifyRows(formatted_op))
  } else {
    awkward.log('');
    awkward.log(data);
  }
}

// terminal/core
var exec = require('child_process').exec;

var formattedCommands = ['ls','cat'];

var run = (command, cb) => {
  var cp = exec(command, { maxBuffer: 200*200*1024 }, (e,r,b) => {
    if (e) {
      awkward.log(chalk.red(e));
      return;
    }
  });
  cp.stdout.on('data', (data) => {
    var data = data.toString()
    cb(data)
  })
}

var modeShell = command => {
  run(command, data => {
    if (_.find(formattedCommands, forCommand => command.startsWith(forCommand))) {
      displayFormatted(data);
    } else {
      awkward.log('');
      awkward.log(data);
    }
  });
}


var modeJs = (command, fn) => {
  run(command, data => {
    var structuredOp = getStructured(data);
    fn = fn.replace('console.log', 'awkward.log.bind(awkward)');
    const sandbox = { structuredOp, awkward };
    const script = new vm.Script(`structuredOp.${fn}`);
    const context = new vm.createContext(sandbox);

    try {
      script.runInContext(context);
      // eval(`structuredOp.${fn}`);
    } catch(error) {
      awkward.log(chalk.red(error));
    }
  });
}


var terminalCore = command => {
  if (command.indexOf('().') > -1) {
    var [cmd, fn] = command.split('().')
    modeJs(cmd, fn);
  } else {
    modeShell(command);
  }
}

// terminal/handler

var terminalHandler = command => {
  if (!command) {
    awkward.log(chalk.green(`Well that's awkward!`));
    return;
  }

  if (command.indexOf('cd ') > -1 || command === 'cd') {
    var location = command.split(' ')[1] ? `/home/${user}`:'/';
    try {
      process.chdir(location);
    } catch (e) {
      awkward.log(chalk.red('No such directory!'));
      return;
    }
    awkward.log(chalk.green(`Changed directory to ${location}`));
    return;
  }
  terminalCore(command);
}

// terminal/main
var handler_action = (args,cb) => {
  terminalHandler(args)
  cb();
}

var terminalMain = awkward => {
  awkward.mode('repl')
    .delimiter('ward:~$')
    .description('Enter the awkward zone.')
    .action(handler_action);
}

terminalMain(awkward);

awkward.exec('repl');

awkward
  .show()
  .parse(process.argv);
