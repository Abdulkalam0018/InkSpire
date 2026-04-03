import { Show, UserButton, SignInButton, SignUpButton } from "@clerk/react";
import AppNav from "./AppNav.jsx";

export default function AppHeader() {
	return (
		<header className="app-header">
			<AppNav />

			<Show when="signed-out">
				<div className="auth-actions">
                    <SignInButton mode="modal" forceRedirectUrl="/" />
                    <SignUpButton mode="modal" forceRedirectUrl="/" />
                </div>
			</Show>

			<Show when="signed-in">
				<UserButton />
			</Show>
		</header>
	);
}
