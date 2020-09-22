import request from "supertest";
import session from "supertest-session";
import { suite } from "uvu";
import * as assert from "uvu/assert";
import app from "../server/app";
import { prisma } from "../server/lib";

const Notes = suite("Notes");
const userSession = session(app);

Notes.after(async () => {
	await prisma.$executeRaw("DELETE FROM notes");
	await prisma.$disconnect();
});

let note: any;
let noteId: number;

Notes("should return a list of anonymously created notes", async () => {
	const response = await request(app).get("/api/notes");
	assert.is(response.status, 200);
	assert.is(response.type, "application/json");
	response.body.forEach(({ author_id }) => {
		assert.is(author_id, null);
	});
});

Notes("should return a note with the matching id", async () => {
	// Create a sample note
	note = await request(app)
		.post("/api/notes")
		.send({ title: "I", description: "Random words" });
	const response = await request(app).get(`/api/notes/${note.body.id}`);
	assert.is(response.status, 200);
	assert.is(response.body.id, note.body.id);
	assert.is(response.body.title, note.body.title);
	assert.is(response.body.description, note.body.description);
	assert.is(response.body.author_id, note.body.author_id);
});

Notes("should return {} if a note with the id does not exist", async () => {
	const response = await request(app).get(`/api/notes/${note.body.id + 1}`);
	assert.is(response.status, 200);
	assert.equal(response.body, {});
});

Notes(
	"should create a note with an anonymous author if user is not authenticated",
	async () => {
		const response = await request(app).post("/api/notes").send({
			title: "Sample post",
			description: "This is a sample post",
		});
		assert.is(response.status, 201);
		assert.is(response.body.title, "Sample post");
		assert.is(response.body.description, "This is a sample post");
	}
);

Notes(
	"should create a note with an author id if user is logged in",
	async () => {
		const user = await userSession
			.post("/api/auth/login")
			.send({ username: "malik", password: "password" });
		const response = await userSession
			.post("/api/notes")
			.send({ title: "I", description: "Yet another sample post" });
		assert.is(response.status, 201);
		assert.is(response.body.author_id, user.body.id);
	}
);

Notes("should not create a note with malformed input", async () => {
	const response = await request(app)
		.post("/api/notes")
		.send({ title: 1, description: "Sample post" });
	assert.is(response.status, 400);
	assert.is(response.body.message, '"title" must be a string');
});

Notes("should allows users to edit anonymous notes", async () => {
	const { id } = await prisma.notes.create({
		data: { title: "Note", description: "Random Note" },
	});
	const response = await request(app)
		.put(`/api/notes/${id}`)
		.send({ description: "This is still a random note" });
	assert.is(response.status, 200);
	assert.is(response.body.id, id);
	assert.is(response.body.description, "This is still a random note");
});

Notes("should allow users to edit their own notes", async () => {
	const note = await userSession.post("/api/notes").send({
		title: "Author's note",
		description: "This is not an anonymous note",
	});
	noteId = note.body.id;
	const response = await userSession
		.put(`/api/notes/${noteId}`)
		.send({ title: "My note" });
	assert.is(response.status, 200);
	assert.is(response.body.id, noteId);
	assert.is(response.body.title, "My note");
});

Notes("should prevent a user from editing another user's note", async () => {
	const response = await request(app)
		.put(`/api/notes/${noteId}`)
		.send({ title: "sabotage" });
	assert.is(response.status, 400);
	assert.is(
		response.body.message,
		"This note can only be modified by its author."
	);
});

Notes("should allow users to delete anonymous notes", async () => {
	const note = await prisma.notes.create({
		data: {
			title: "Sample note",
			description: "This is a sample note",
		},
	});
	const response = await request(app).delete(`/api/notes/${note.id}`);
	assert.is(response.status, 200);
	assert.is(response.body.id, note.id);
	const deletedNote = await prisma.notes.findOne({ where: { id: note.id } });
	assert.is(deletedNote, null);
});

Notes("should prevent a user from deleting another user's note", async () => {
	const note = await userSession
		.post("/api/notes/")
		.send({ title: "Note", description: "These titles are getting lazy." });
	noteId = note.body.id;
	const response = await request(app).delete(`/api/notes/${noteId}`);
	assert.is(response.status, 400);
	assert.is(
		response.body.message,
		"This note can only be modified by its author."
	);
});

Notes("should allow users to delete their own notes", async () => {
	const response = await userSession.delete(`/api/notes/${noteId}`);
	assert.is(response.status, 200);
	assert.is(response.body.id, noteId);
	const deletedNote = await prisma.notes.findOne({ where: { id: noteId } });
	assert.is(deletedNote, null);
});

Notes.run();
