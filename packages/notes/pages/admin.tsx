import React from "react";
import { GetServerSideProps } from "next";
import {
	Grid,
	User,
	usePageProvider,
	Activator,
	CreateUserModal,
} from "../components";
import { PageContext } from "../types";

export default () => {
	const { state } = usePageProvider();
	const { isUserModalOpen, users } = state;
	return (
		<React.Fragment>
			<Grid>
				{users.map((user) => (
					<User key={user.id} user={user} />
				))}
			</Grid>
			<Activator />
			{isUserModalOpen && <CreateUserModal />}
		</React.Fragment>
	);
};

export const getServerSideProps: GetServerSideProps = async ({
	req,
	res,
}: PageContext) => {
	if (!req.user || !req.user.admin) {
		res
			.writeHead(302, {
				Location: "/login",
			})
			.end();
			return {
				props: {},
			};
	} else {
		const url = `${process.env.API_URL}/users`;
		const response = await fetch(url, {
			headers: { cookie: req.headers.cookie },
		});

		if (response.ok) {
			const users = await response.json();
			return {
				props: { users },
			};
		}
		throw new Error(response.statusText);
	}
};
