import request from "supertest";
import session from "supertest-session";
import { suite } from "uvu";
import * as assert from "uvu/assert";
import bcrypt from "bcrypt";
import app from "../server/app";
import { prisma } from "../server/lib";

const Users = suite("Users");
const userSession = session(app);
let username: string;
let id: number;

Users.before(async () => {
	// create an admin user
	const user = await prisma.users.upsert({
		where: {
			username: "admin",
		},
		create: {
			username: "admin",
			password: bcrypt.hashSync("password", 10),
			admin: true,
		},
		update: {},
	});
	id = user.id;
	username = user.username;
});
//WHERE username = 'ghost';
Users.after(async () => {
	await prisma.$queryRaw("DELETE FROM notes;");
	await prisma.$queryRaw("DELETE FROM users;");
	await prisma.$disconnect();
});

Users("should return all notes created by the specified user", async () => {
	await prisma.$queryRaw(`
    INSERT INTO notes (title, description, author_id) VALUES
    ('I', 'Note one', ${id}),
    ('II', 'Note two', ${id}),
    ('III', 'Note three', ${id}),
    ('IV', 'Note four', ${id})
  ;`);
	const response = await request(app).get(`/api/users/${username}/notes`);
	assert.is(response.status, 200);
	assert.is(response.body.length, 4);
	response.body.forEach(({ author_id }) => {
		assert.is(author_id, id);
	});
});

Users("should allow admin to create new users", async () => {
  await userSession
    .post("/api/auth/login")
    .send({ username: "admin", password: "password" });
  const response = await userSession
    .post("/api/users")
    .send({ username: "Batman", password: "password" });
  const { username, admin } = response.body;
  assert.is(response.status, 201);
  assert.is(username, "Batman");
  assert.is(admin, false);
});

Users("should disallow duplicate usernames", async () => {
  const response = await userSession
    .post("/api/users")
    .send({ username: "Batman", password: "password" });
  const { message } = response.body;
  assert.is(response.status, 400);
  assert.is(message, "Username Batman is already taken.");
});


Users("should restrict non admin users from creating users", async () => {
  const response = await request(app)
    .post("/api/users")
    .send({ username: "random", password: "password" });
  const { message } = response.body;
  assert.is(response.status, 400);
  assert.is(message, "Only admin can create users.");
});

Users.run();
