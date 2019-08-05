const sequelize = require("sequelize");
let db;

if (process.env.NODE_ENV == "production") {
  db = require("../remotedb");
} else {
  db = require("../database");
}

module.exports = db.define("admins", {
  eid: {
    type: sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  username: {
    type: sequelize.STRING,
    allowNull: false
  },
  email: {
    type: sequelize.STRING,
    allowNull: false
  },
  citizenship: {
    type: sequelize.STRING,
    allowNull: false
  },
  password: {
    type: sequelize.STRING,
    allowNull: false
  },
  image: {
    type: sequelize.STRING,
    allowNull: true,
    default: "/images/img.png"
  }
});
