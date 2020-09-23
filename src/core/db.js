const autoTranslate = require("./auto");
const Sequelize = require("sequelize");
const logger = require("./logger");
const Op = Sequelize.Op;
var dbEmbedValue ="";
const colors = require("../core/colors");
//var dbBot2BotValue =""; //Bot2Bot Code, Not working :(


const db = process.env.DATABASE_URL.endsWith(".db") ?
   new Sequelize({
      dialect: "sqlite",
      storage: process.env.DATABASE_URL
   }) :
   new Sequelize(process.env.DATABASE_URL, {
      logging: console.log
      //logging: null,
   });

db
   .authenticate()
   .then(() =>
   {
      logger("dev","Successfully connected to database");
   })
   .catch(err =>
   {
      logger("error", err);
   });
//--
const Servers = db.define("servers", {
   id: {
      type: Sequelize.STRING(32),
      primaryKey: true,
      unique: true,
      allowNull: false
   },
   lang: {
      type: Sequelize.STRING(8),
      defaultValue: "en"
   },
   count: {
      type: Sequelize.INTEGER,
      defaultValue: 0
   },
   active: {
      type: Sequelize.BOOLEAN,
      defaultValue: true
   },
   embedstyle: {
      type: Sequelize.STRING(8),
      defaultValue: "off"
   },
   bot2botstyle: {
      type: Sequelize.STRING(8),
      defaultValue: "off"
   }
});
//--
const Tasks = db.define("tasks", {
   origin: Sequelize.STRING(32),
   dest: Sequelize.STRING(32),
   reply: Sequelize.STRING(32),
   server: Sequelize.STRING(32),
   active: {
      type: Sequelize.BOOLEAN,
      defaultValue: true
   },
   LangTo: {
      type: Sequelize.STRING(8),
      defaultValue: "en"
   },
   LangFrom: {
      type: Sequelize.STRING(8),
      defaultValue: "en"
   }
},
{
   indexes: [
      {
         unique: true,
         fields: ["origin", "dest"]
      }
   ]
});

// -------------------
// Init/create tables
// -------------------

exports.initializeDatabase = function()
{
   Servers.sync({ logging: console.log });
   Tasks.sync({ logging: console.log });
   // Add global server row
   Servers.upsert({ id: "bot",
      lang: "en" });
};

// -----------------------
// Add Server to Database
// -----------------------

exports.addServer = function(id, lang)
{
   return Servers.create({
      id: id,
      lang: lang
   });
};

// ------------------
// Deactivate Server
// ------------------

exports.removeServer = function(id)
{
   return Servers.update({ active: false }, { where: { id: id } }).then(
      function (err, _result)
      {
         logger("error", err);
      });
};

// -------------------
// Update Server Lang
// -------------------

exports.updateServerLang = function(id, lang, _cb)
{
   return Servers.update({ lang: lang }, { where: { id: id } }).then(
      function ()
      {
         _cb();
      });
};

// -------------------
// Update Embedded Variable in DB
// -------------------

exports.updateEmbedVar = function(id, embedstyle, _cb)
{
   console.log(`updateEmbedVar ` + embedstyle);
   dbEmbedValue = embedstyle;
   return Servers.update({ embedstyle: embedstyle }, { where: { id: id } }).then(
      function ()
      {
         _cb();
      });
};

// -------------------
// Get Embedded Variable From DB
// -------------------

exports.getEmbedVar = async function run(id)
{
   var value = await db.query(`select * from (select embedstyle as "embedstyle" from servers where id = ?)`, { replacements: [id],
      type: db.QueryTypes.SELECT});
   dbEmbedValue = value[0].embedstyle;
   //console.log (`getEmbedVar Log Value ` + value[0].embedstyle);
   console.log(`getEmbedVar Log Local ` + dbEmbedValue);
   return this.setEmbedVar();
   //return value[0].embedstyle;
   //return dbEmbedValue;
};

// -------------------
// Call Saved Embedded Variable Value From DB
// -------------------

module.exports.setEmbedVar = function(data)
{
   console.log(`setEmbedVar Log ` + dbEmbedValue);
   return dbEmbedValue;
};

/* Bot2Bot code, Not working :(

// -------------------
// Update Bot2Bot Variable In DB
// -------------------

exports.updateBot2BotVar = function(id, bot2botstyle, _cb)
{
   console.log (`updateBot2BotVar ` + bot2botstyle);
   dbBot2BotValue = bot2botstyle
   return Servers.update({ bot2botstyle: bot2botstyle }, { where: { id: id } }).then(
      function ()
      {
         _cb();
      });
};

// -------------------
// Get Bot2Bot Variable From DB
// -------------------

exports.getBot2BotVar = async function run(id)
{
   var value = await db.query(`select * from (select bot2botstyle as "bot2botstyle" from servers where id = ?)`, { replacements: [id], type: db.QueryTypes.SELECT})
   dbBot2BotValue = value[0].bot2botstyle
   //console.log (`getBot2BotVar Log Value ` + value[0].bot2botstyle);
   console.log (`getBot2BotVar Log Local ` + dbBot2BotValue);
   return this.setBot2BotVar();
   //return value[0].bot2botstyle;
   //return dbBot2BotValue;
};

// -------------------
// Call Saved Bot2Bot Variable Value From DB
// -------------------

module.exports.setBot2BotVar = function(data)
{
   console.log (`setBot2BotVar Log ` + dbBot2BotValue)
   return dbBot2BotValue;
};
*/



// ------------------
// Add Missing Variable Columns
// ------------------

exports.updateColumns = function(data)
{
   db.query("ALTER TABLE servers ADD embedstyle VARCHAR(8) DEFAULT off;",function(err)
   {
      if (err)
      {
         console.log("ERROR:"+err.message);
      }
      else
      {
         console.log("embedstyle column added");
      }
   });
   db.query("ALTER TABLE servers ADD bot2botstyle VARCHAR(8) DEFAULT off;",function(err)
   {
      if (err)
      {
         console.log("ERROR:"+err.message);
      }
      else
      {
         console.log("bot2botstyle column added");
      }
   });
};

// ------------------
// Get Channel Tasks
// ------------------



exports.channelTasks = function(data)
{
   var id = data.message.channel.id;
   if (data.message.channel.type === "dm")
   {
      id = "@" + data.message.author.id;
   }
   try
   {
      const taskList = Tasks.findAll({ where: { origin: id,
         active: true }}).then(
         function (result)
         {
            data.rows = result;
            return autoTranslate(data);
         });
   }
   catch (e)
   {
      logger("error", e);
      data.err = e;
      return autoTranslate(data);
   }
};
// --------------------------------
// Get tasks for channel or user
// --------------------------------

exports.getTasks = function(origin, dest, cb)
{
   if (dest === "me")
   {
      return Tasks.findAll({ where: { origin: origin,
         dest: dest } }, {raw: true}).then(
         function (result, err)
         {
            cb(err, result);
         });
   }
   return Tasks.findAll({ where: { origin: origin } }, {raw: true}).then(
      function (result, err)
      {
         cb(err, result);
      });
};

// --------------------------------
// Check if dest is found in tasks
// --------------------------------

exports.checkTask = function(origin, dest, cb)
{
   if (dest === "all")
   {
      return Tasks.findAll({ where: { origin: origin } }, {raw: true}).then(
         function (result, err)
         {
            cb(err, result);
         });
   }
   return Tasks.findAll({ where: { origin: origin,
      dest: dest } }, {raw: true}).then(
      function (result, err)
      {
         cb(err, result);
      });
};

// --------------------
// Remove Channel Task
// --------------------

exports.removeTask = function(origin, dest, cb)
{
   console.log("removeTask()");
   if (dest === "all")
   {
      console.log("removeTask() - all");
      return Tasks.destroy({ where: { [Op.or]: [{ origin: origin },{ dest: origin }] } }).then(
         function (err, result)
         {
            cb(null, result);
         });
   }
   return Tasks.destroy({ where: { [Op.or]: [{ origin: origin,
      dest: dest },{ origin: dest,
      dest: origin }] } }).then(
      function (err, result)
      {
         cb(null, result);
      });
};

// --------------
// Get Task Count
// --------------

exports.getTasksCount = function(origin, cb)
{
   return Tasks.count({ where: {"origin": origin }}).then(c =>
   {
      cb("", c);
   });
};

// ------------------
// Get Servers Count
// ------------------

exports.getServersCount = function(cb)
{
   return Servers.count().then(c =>
   {
      cb("", c);
   });
};

// ---------
// Add Task
// ---------

exports.addTask = function(task)
{
   // Tasks.upsert({
   //   orign: task.origin,
   //   dest: task.dest,
   //   reply: task.reply, // + task.origin.slice(-3),
   //   server: task.server,
   //   active: true,
   //   lang_to: task.to,
   //   lang_from: task.from,
   // }).then(() => {
   //   console.log('Task added successfully.');
   // })
   // .catch(err => {
   //   console.error('Unable to add task to the database:', err);
   // });


   task.dest.forEach(dest =>
   {
      Tasks.upsert({
         origin: task.origin,
         dest: dest,
         reply: task.reply, // + task.origin.slice(-3),
         server: task.server,
         active: true,
         LangTo: task.to,
         LangFrom: task.from
      }).then(() =>
      {
         logger("dev", "Task added successfully.");
      })
         .catch(err =>
         {
            logger("error", err);
         });
   });
};

// ------------
// Update stat
// ------------

exports.increaseServers = function(id)
{
   return Servers.increment("count", { where: { id: id }});
};

// --------------
// Get bot stats
// --------------

exports.getStats = function(callback)
{
   return db.query(`select * from (select sum(count) as "totalCount", ` +
  `count(id)-1 as "totalServers" from servers) as table1, ` +
  `(select count(id)-1 as "activeSrv" from servers where active = TRUE) as table2, ` +
  `(select lang as "botLang" from servers where id = 'bot') as table3, ` +
  `(select count(distinct origin) as "activeTasks" ` +
  `from tasks where active = TRUE) as table4, ` +
  `(select count(distinct origin) as "activeUserTasks" ` +
  `from tasks where active = TRUE and origin like '@%') as table5;`, { type: Sequelize.QueryTypes.SELECT})
      .then(
         result => callback(result),
         err => logger("error", err + "\nQuery: " + err.sql, "db")
      );
};

// ----------------
// Get server info
// ----------------

exports.getServerInfo = function(id, callback)
{
   return db.query(`select * from (select count as "count",` +
   `lang as "lang" from servers where id = ?) as table1,` +
   `(select count(distinct origin) as "activeTasks"` +
   `from tasks where server = ?) as table2,` +
   `(select count(distinct origin) as "activeUserTasks"` +
   `from tasks where origin like '@%' and server = ?) as table3, ` +
   `(select embedstyle as "embedstyle" from servers where id = ?) as table4, ` +
   `(select bot2botstyle as "bot2botstyle" from servers where id = ?) as table5;`, { replacements: [ id, id, id, id, id],
      type: db.QueryTypes.SELECT})
      .then(
         result => callback(result),
         err => logger("error", err + "\nQuery: " + err.sql, "db")

      );
};

// ---------
// Close DB
// ---------

exports.close = function()
{
   return db.close();
};
