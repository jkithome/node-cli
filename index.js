var chalk = require('chalk');
var clear = require('clear');
var CLI = require('clui');
var figlet = require('figlet');
var inquirer = require('inquirer');
var Preferences = require('preferences');
var Spinner = CLI.Spinner;
var GitHubApi = require('github');
var _ = require('lodash');
var git = require('simple-git')();
var touch = require('touch');
var fs = require('fs');
var files = require('./lib/files');
var github = new GitHubApi({
  version: '3.0.0'
})

clear();
console.log(
  chalk.yellow(
    figlet.textSync('Ginit', { horizontalLayout: 'full' })
  )
);

// if (files.directoryExists('.git')) {
//   console.log(chalk.red('Already a git repository!'));
//   process.exit();
// }

function getGithubCredentials(callback) {
  var questions = [{
    name: 'username',
    type: 'input',
    message: 'Enter your Github username or e-mail address:',
    validate: function(value) {
      if (value.length) {
        return true;
      } else {
        return 'Please enter your username or e-mail address';
      }
    }
  }, {
    name: 'password',
    type: 'password',
    message: 'Enter your password:',
    validate: function(value) {
      if (value.length) {
        return true;
      } else {
        return 'Please enter your password';
      }
    }
  }];
  inquirer.prompt(questions).then(callback)
};

function getGithubToken(callback) {
  var prefs = new Preferences('ginit');
  if (prefs.github && prefs.github.token) {
    return callback(null, prefs.github.token);
  }
  getGithubCredentials(function(credentials) {
    var status = new Spinner('Auntheticating you, please wait...');
    status.start();
    github.authenticate(
      _.extend({
          type: 'basic',
        },
        credentials
      )
    );

    github.authorization.create({
      scopes: ['user', 'public_repo', 'repo', 'repo:status'],
      note: 'ginit, the command-line tool for initializing Git repos'
    }, function(err, res) {
      status.stop();
      if (err) {
        return callback(err);
      }
      if (res.token) {
        prefs.github = {
          token: res.token
        };
        return callback(null, res.token);
      }
      return callback();
    })
  })
}

getGithubToken(function(err, res) {
  console.log(`Err: ${err} Res: ${res}`);
});

function createGitignore(callback) {
  var filelist = _.without(fs.readdirSync(','), '.git', '.gitignore');
  if (filelist.length) {
    inquirer.prompt(
      [
        {
          type: 'checkbox',
          name: 'ignore',
          messsage: 'Select the files and/or folders you wish to ignore:',
          choices: filelist,
          default: ['node_modules', 'bower_components']
        }
      ]
    ).then(function(answers) {
      if (answers.ignore.length) {
        fs.writeFileSync('.gitignore', answers.ignore.join('\n'));
      } else {
        touch('.gitignore')
      }
      return callback();
    });
  } else {
    touch('.gitignore');
    return callback();
  }
}

function createRepo(callback) {
  var argv = require('minimist')(process.argv.slice(2));
  var questions = [
    {
      type: 'input',
      name: 'name',
      message: 'Enter a name for hte repository:',
      default: argv._[0] || files.getCurrentDirectoryBase(),
      validate: function(value) {
        if (value.length) {
          return true;
        } else {
          return 'Please enter a name for the repository';
        }
      }
    },
    {
      type: 'input',
      name: 'description',
      default: argv._[1] || null,
      mesage: 'Optionally enter a description of the repository:'
    },
    {
      type: 'list',
      name: 'visibility',
      message: 'Public or private:',
      choices: ['public','private'],
      default: 'public'
    }
  ];

  inquirer.prompt(questions).then(function(answers) {
    var status = new Spinner('Creating repository...');

    var data = {
      name: answers.name,
      description: answers.description,
      private: (answers.visibility === 'private')
    };

    github.repos.create(
      data,
      function(err, res) {
        status.stop();
        if(err) {
          return callback(err);
        }
        return callback(null, res.ssh_url);
      }
    );
  });
}

function setupRepo(url, callback) {
  var status = new Spinner('Setting up the repository';
    status.start();

    git
      .init()
      .add('.gitignore')
      .add('./*')
      .commit('Initial commmit')
      .addRemote('origin', url)
      .push('origin', 'master')
      .then(function() {
        status.stop();
        return callback();
      });
  )
}
