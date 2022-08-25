const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const jwtToken = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const app = express();

app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(5000);
    console.log("Server is Running");
  } catch (e) {
    console.log(e.message);
    process.exit(1);
  }
};
initializeServer();

module.exports = app;

function authenticate(request, response, next) {
  let token;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    token = authHeader.split(" ")[1];
  }
  if (token === undefined) {
    response.send("Invalid JWT Token");
    response.status(401);
  } else {
    jwt.verify(token, "Hasini", async (error, payLoad) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
}

const convertStateDbObjectToResponseObject = (state) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convert = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUser = `
    select * from user where username = '${username}';
    `;
  const dbUser = await db.get(getUser);
  if (dbUser === undefined) {
    response.send("Invalid User");
    response.status(400);
  } else {
    const check = await bcrypt.compare(dbUser.password, password);
    if (check !== true) {
      response.send("Invalid Password");
      response.status(400);
    } else {
      const payLoad = { username: username };
      const jwtToken = jwt.sign(payLoad, "Hasini");
      response.send({ jwtToken });
    }
  }
});

app.get("/states/", authenticate, async (request, response) => {
  const getStates = `
    select * from state
    `;
  const states = await db.all(getStates);
  response.send(
    state.map((eachState) => {
      convertStateDbObjectToResponseObject(eachState);
    })
  );
});

app.get("/states/:stateId/", authenticate, async (request, response) => {
  const { stateId } = request.params;
  const getState = `
    select * from state where state_id = ${stateId};
    `;
  const state = await db.get(getState);
  response.send(convertStateDbObjectToResponseObject(state));
});

app.post("/districts/", authenticate, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addDistrict = `
    insert into district (district_name,state_id,cases, cured, active, deaths) 
    values (
        '${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths}
    );
    `;
  await db.run(addDistrict);
  response.send("District Successfully Added");
});

app.get("/districts/:districtId/", authenticate, async (request, response) => {
  const { districtId } = request.params;
  const getDist = `
    select * from district where district_id = ${districtId};
    `;
  const dist = await db.get(getDist);
  response.send(convert(dist));
});

app.delete(
  "/districts/:districtId/",
  authenticate,
  async (request, response) => {
    const { districtId } = request.params;
    const del = `
 delete from district where district_id = ${districtId};
 `;
    await db.run(del);
    response.send("District Removed");
  }
);

app.get("/states/:stateId/stats/", authenticate, async (request, response) => {
  const { stateId } = request.params;
  const getStats = `
    select SUM(cases), SUM(cured),SUM(active), SUM(deaths) from district where state_id = ${stateId};
    `;
  const stats = await db.get(getStats);
  response.send({
    totalCases: stats["SUM(cases)"],
    totalCured: stats["SUM(cured)"],
    totalActive: stats["SUM(active)"],
    totalDeaths: stats["SUM(deaths)"],
  });
});

app.put("/districts/:districtId/", authenticate, async (request, response) => {
  const { districtId } = request.params;
  const { districtName, stateId, cases, cured, active, deaths } = request.body;

  const update = `
     update district set district_name = '${districtName}',
     state_id  = '${stateId}',
     cases = '${cases}',
     cured  = '${cured}',
     active = '${active}',
     deaths = '${deaths}'
     where district_id = ${districtId};
     `;
  await db.run(update);
  response.send("District Details Updated");
});
