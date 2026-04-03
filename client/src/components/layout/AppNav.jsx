import { Show } from "@clerk/react";
import { NavLink } from "react-router-dom";

function navClassName({ isActive }) {
	return `app-nav-link${isActive ? " is-active" : ""}`;
}

export default function AppNav() {
	return (
		<nav className="app-nav" aria-label="Main navigation">
			<NavLink to="/" className={navClassName}>
				Home
			</NavLink>
		</nav>
	);
}
