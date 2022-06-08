from datetime import datetime
from flask import Flask, flash, render_template, request, redirect, url_for, session
from flask_session import Session
from flask_socketio import SocketIO, join_room, leave_room, emit
# import functools
import os
from passlib.hash import pbkdf2_sha256
from pymongo import MongoClient
import pytz
from random import choice
from dotenv import load_dotenv

load_dotenv()

socketio = SocketIO(ping_interval=5)

# def login_required(route):
#     @functools.wraps(route)
#     def route_wrapper(*args, **kwargs):
#         if not session.get('username'):
#             return redirect(url_for('login'))
#         return route(*args, **kwargs)
#     return route_wrapper

def create_app():
    app = Flask(__name__)
    client = MongoClient(os.environ.get('MONGODB_URI'))
    app.db = client.othello

    app.debug = True
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY')
    app.config['SESSION_TYPE'] = 'filesystem'
    # app.config['SESSION_PERMANENT'] = False
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

    Session(app)

    # socketio = SocketIO(app, manage_session=False)

    @app.get("/")
    # @login_required
    def home():
        username = session.get('username')
        if (username):
            user = app.db.players.find_one({'username': username})
            return render_template('home.html', username = session['username'], record = user['record'], game_log = user['game_log'], sent_invitations = user['sent_invitations'], received_invitations = user['received_invitations'], accepted_invitations = user['accepted_invitations'])
        return render_template('home.html', username = None)

    @app.route("/register", methods=['GET', 'POST'])
    def register():
        if (request.method=='GET'):
            return render_template("register.html")
        else:
            username = request.form['username']
            password = request.form['password']
            password_hash = pbkdf2_sha256.hash(password)
            # confirm = request.form['confirm']
            if (app.db.players.count_documents({'username': username}) > 0):
                flash('That username is taken.', 'error')
                return redirect(url_for('register'))
            elif (len(password) < 6):
                flash('Password must be at least 6 characters long.','error')
                return redirect(url_for('register'))
            # elif (password != confirm):
            #     flash('Passwords do not match!','error')
            #     return redirect(url_for('register'))
            else:
                # create use and add it to the database
                app.db.players.insert_one({
                    'username': username,
                    'password': password_hash,
                    'sent_invitations': [],
                    'received_invitations': [],
                    'accepted_invitations': {},
                    'game_log': [],
                    'record': {
                        'win': 0,
                        'loss': 0,
                        'tie': 0
                    }
                })
                session['username'] = username
                return redirect(url_for('home'))

    @app.route("/login", methods=['GET','POST'])
    def login():
        if (request.method=='GET'):
            return render_template("login.html")
        else:
            # verify that user exists and password is correct
            username = request.form['username']
            password = request.form['password']
            user = app.db.players.find_one({'username': username})
            if (user and pbkdf2_sha256.verify(password, user['password'])):
                session['username'] = username
                return redirect(url_for('home'))
            else:
                flash('Login info not valid.', 'error')
                return redirect(url_for('login'))

    @app.route("/logout")
    def logout():
        if 'username' in session:
            username = session.get('username')
            print(f'{username} has logged out')
            app.db.players.update_one({'username': username}, { '$set': {'sid': ''} })
            notify_friends_offline()
            session.clear()
            # flash('You have been logged out', 'success')
        return redirect(url_for('home'))

    @socketio.on('home')
    def home():
        
        username = session.get('username')
        if (username):
            # retrieve the user's sid for the current session and store it in database
            sid = request.sid
            session['sid'] = sid
            username = session.get('username')
            app.db.players.update_one({'username': username}, { '$set': {'sid': sid} })
            notify_friends('online')

    @socketio.on('update_record')
    def update_record(data):
        # grab win-loss record and game log and send it back to user
        date_client = data['date']
        time_client = data['time']
        username = session.get('username')
        user = app.db.players.find_one({'username': username})
        game_server = user['game_log'][0]

        if game_server['date'] != date_client or game_server['time'] != time_client:
            print('send game to client')
            emit('record_update', {'record': user['record'], 'game': user['game_log'][0]})
        else:
            print('game log already up to date')

    def notify_friends_offline():
        username = session.get('username')
        status = 'offline'

        if username:
            print(f'{username} notifying friends that they are offline')
            user = app.db.players.find_one({'username': username})
            sent = user['sent_invitations']
            received = user['received_invitations']
            invitations = sent + received
            for friend in invitations:
                # retrive sid for each invite, if they are online
                friend_sid = get_user_sid(friend)
                if friend_sid:
                    socketio.emit('friend_online_status', {'friend': username, 'status': status}, to=friend_sid)

            # accepted_invitations = user['accepted_invitations']
            # for friend in accepted_invitations:
            #     cancel_game({'invitee': friend, 'code': status})

    def notify_friends(status):
        # send messages to everyone you have sent an invite to to let them know you are now online (or offline)
        # this is so those clients can enable the buttons to accept your invitation
        username = session.get('username')

        if username:
            print(f'{username} notifying friends that they are {status}')
            user = app.db.players.find_one({'username': username})
            sent = user['sent_invitations']
            received = user['received_invitations']
            invitations = sent + received
            for friend in invitations:
                # retrive sid for each invite, if they are online
                friend_sid = get_user_sid(friend)
                if friend_sid:
                    emit('friend_online_status', {'friend': username, 'status': status}, to=friend_sid)

            if (status == 'unavailable' or status == 'offline'):
                accepted_invitations = user['accepted_invitations']
                for friend in accepted_invitations:
                    cancel_game({'invitee': friend, 'code': status})
                    # emit('friend_online_status', {'friend': username, 'status': status}, to=friend_sid)


    @socketio.on('get_online_friends')
    def get_online_friends(data):
        username = session.get('username')

        if (username):
            # retrieve list of people who have sent you invitations
            user = app.db.players.find_one({'username': username})
            received_online = []
            for friend in user['received_invitations']:
                # check if the friend is currently online
                user_data = app.db.players.find_one({'username': friend})
                if user_data['sid']:
                    print(f'{friend} is online.')
                    received_online.append(friend)
                else:
                    print(f'{friend} is offline.')

            sent_online = []
            for friend in user['sent_invitations']:
                # check if the friend is currently online
                user_data = app.db.players.find_one({'username': friend})
                if user_data['sid']:
                    print(f'{friend} is online.')
                    sent_online.append(friend)
                else:
                    print(f'{friend} is offline.')

            # send list of online friends back to user
            emit('online_friends', {'received_online': received_online, 'sent_online': sent_online})


    @socketio.on('join')
    def join(data):
        username = session.get('username')
        if (data['game_mode'] == 'vs'):
            opponent = data['invitee']
            print(f'{username} joined game with {opponent}')
            # get room and color from the database entry
            user = app.db.players.find_one({'username': username})
            game_info = user['accepted_invitations'][opponent]
            print(game_info)
            room = game_info[0]
            color = game_info[1]
            session['room'] = room
            session['opponent'] = opponent
            # remove the invitation from the database
            app.db.players.update_one({'username': username}, { '$unset': {f'accepted_invitations.{opponent}': 1 } })
            join_room(room)
            notify_friends('unavailable')
            emit('player', {'username': username, 'opponent': opponent, 'color': color})
            # the other player has already joined the game
            # alert your opponent that you have joined the game
            opp = app.db.players.find_one({'username': opponent})
            session['opp_sid'] = opp['sid']
            emit('start_game', {}, to=room)
        else:
            opponent = 'Computer'
            session['opponent'] = opponent
            session['difficulty'] = data['difficulty']
            emit('player', {'username': username, 'opponent': opponent, 'color': 'black'})
            emit('start_game')

    @socketio.on('move')
    def move(data):
        room = session.get('room')
        print('socket message "move"')
        print(f'room: {room}')
        emit('move', {'player': data['player'], 'row': data['row'], 'col': data['col']}, to=room)

    @socketio.on('available')
    def available():
        notify_friends('available')

    @socketio.on('clear_opp_data')
    def clear_opp_data():
        session.pop('opponent')
        session.pop('opp_sid')

    @socketio.on('rematch')
    def rematch(data):
        opponent = session.get('opponent')
        if opponent == 'Computer':
            emit('start_game')
        else:
            room = session.get('room')
            player = data['player']
            rematch_status = data['rematch']
            if (not rematch_status):
                # send message to invitees to let them know your game is over and you are now
                # available again
                notify_friends('available')
                leave_room(room)
                session.pop('opp_sid')
                session.pop('opponent')
            # opp = app.db.players.find_one({'username': opponent})
            # sid = opp['sid']
            # print(sid)
            emit('rematch_status', {'sender': player, 'rematch': rematch_status}, to=room)

    @socketio.on('trigger_start_game')
    def trigger_start_game():
        emit('start_game')

    @socketio.on('disconnect')
    def disconnect():
        username = session.get('username')
        opp_sid = session.get('opp_sid')

        # Disconnect event takes >30 seconds to fire, in which time the user may have logged back in
        # We check first if this user has logged back in before notifying friends he is offline
        # This is to prevent situation where friends have been told this user is offline when he is
        # still online.

        # retrieve sid currently stored in database and compare it to the sid stored in the session
        # if they are different, that means the user has logged in again since the disconect event fired,
        # in which case we do not want to proceed with any disconnect bookkeeping
        if username:
            sid = get_user_sid(username)
            session_sid = session.get('sid')
            print(f'SID from database: {sid}')
            print(f'SID from session: {session_sid}')
            if not sid or sid == session_sid:
                if sid == session_sid:
                    print(f'SID for {username} in database matches SID stored in session')
                if not sid:
                    print(f'SID in database is empty')
                notify_friends('offline')
                print(f'{username} disconnected.')

                # update database so sid is no longer listed
                # this serves as a way of keeping track of who is online
                app.db.players.update_one({'username': username}, { '$set': {'sid': ''} })

                if opp_sid:
                    emit('opp_disconnect', {'code': 'offline', 'opponent': username}, to=opp_sid)

            else:
                print(f'{username} has logged back in after disconnecting')

    def get_user_sid(username):
        user = app.db.players.find_one({'username': username})
        return(user['sid'])

    @socketio.on('remove_accepted_invitation')
    def remove_accepted_invitation(data):
        username = session.get('username')
        opponent = data['opponent']
        app.db.players.update_one({'username': username}, { '$unset': {f'accepted_invitations.{opponent}': 1 } })

    @socketio.on('opp_forfeit')
    def opp_forfeit():
        room = session.get('room')
        update_game_log('win')
        leave_room(room)

    def update_game_log(game_outcome, my_score = '--', opp_score = '--'):
        username = session.get('username')
        opponent = session.get('opponent')
        date_time = datetime.now(pytz.timezone('US/Pacific'))
        date = date_time.strftime('%m/%d/%Y')
        time = date_time.strftime('%I:%M:%S %p')

        if (opponent == 'Computer'):
            opponent = 'CPU (' + session.get('difficulty') + ')'

        game_summary = {
            'opponent': opponent,
            'outcome': game_outcome,
            'my_score': my_score,
            'opp_score': opp_score,
            'date': date,
            'time': time
        }
        app.db.players.update_one(
            {'username': username},
            { 
                '$push': {
                    'game_log': {
                        '$each': [game_summary],
                        '$position': 0
                    }
                }
            }
        )

        # update record
        app.db.players.update_one({'username': username}, { '$inc': {f'record.{game_outcome}': 1} })

        print(f'{username} has been credited with a {game_outcome}.')

        # If no scores were provided, we know that this is a victory by forfeit, meaning the opponent left the game
        # Since the opponent is no longer logged in, we also need to update their game log

        if (my_score == '--'):
            game_summary_opp = {
                'opponent': username,
                'outcome': 'loss',
                'my_score': '--',
                'opp_score': '--',
                'date': date,
                'time': time
            }

            app.db.players.update_one(
                {'username': opponent},
                { 
                    '$push': {
                        'game_log': {
                            '$each': [game_summary_opp],
                            '$position': 0
                        }
                    }
                }
            )

            # update record of opponent
            app.db.players.update_one({'username': opponent}, { '$inc': {f'record.loss': 1} })
            print(f'{opponent} has been credited with a loss.')


    @socketio.on('invite')
    def invite(data):
        inviter = session.get('username')
        invitee = data['invitee']
        invite_status = 'error'
        status = ''
        msg = ''
        # check if the invited user actually exists

        user = app.db.players.find_one({'username': inviter})
        opponent = app.db.players.find_one({'username': invitee})
 
        if (not opponent): # check if this user exists
            msg = 'This user does not exist'
        elif (inviter in opponent['received_invitations']):
            msg = 'You already sent an invitation to this user'
            invite_status = 'info'
        elif (invitee in user['received_invitations']):
            msg = 'This user has already sent you an invitation'
            invite_status = 'info'
        elif (inviter == invitee):
            msg = "You can't send an invitation to yourself"
        else:
            invite_status = 'success'
            msg = 'Invitation sent!'
            # update database for the invitee indicating they have an invitation waiting
            app.db.players.update_one({'username': invitee}, { '$push': {'received_invitations': inviter} })
            # update database for the inviter indicating they sent an invitation
            app.db.players.update_one({'username': inviter}, { '$push': {'sent_invitations': invitee} })
            print(f'invitation from {inviter} to {invitee}')

            # check if this player is currently online by seeing if they have an sid listed in the database
            # if they are online, send message letting them know of the invitation
            
            sid = opponent['sid']
            if len(sid) > 0:
                status = 'online'
                print('invitee found online')
                print(f'invite sent to sid {sid}')
                # emit('invitation_received', {'inviter': inviter}, to=sid)
                emit('invitation', {'inviter': inviter}, to=sid)

            # sent message back to the inviter that invitation was successfully sent
            # emit('invite_status', {'invite_success': True, 'invitee': invitee, 'status': status})
                
        emit('invite_status', {'invite_status': invite_status, 'online_status': status, 'msg': msg, 'invitee': invitee})

    @socketio.on('invite_response')
    def invite_response(data):
        username = session['username']
        opponent = data['inviter']
        accepted = data['acceptedBool']

        ### TO ADD ###
        # verify that the invitation actually exists

        # remove invitation from the inviter's database
        app.db.players.update_one({'username': opponent}, { '$pull': {'sent_invitations': username} })
        # remove invitation from invitee's database
        app.db.players.update_one({'username': username}, { '$pull': {'received_invitations': opponent} })
        # send message back to invitee letting them know to refresh their page so the invitation no longer displays
        # emit('refresh')
        
        opp = app.db.players.find_one({'username': opponent})
        opp_sid = opp['sid']
        if (accepted):
            # create room
            print(f'{username} accepted invitation from {opponent}')
            room = opponent + '_' + username
            session['playerID'] = 'invitee'
            session['opponent'] = opponent
            session['room'] = room
            join_room(room)
            # randomly assign a color
            color = choice(['white', 'black'])
            opp_color = flip_color(color)
            # update opponent's database to show the accepted invitation
            # entry consists of an array which contains the room name and the color assigned to the user for this game
            app.db.players.update_one({'username': opponent}, { '$set': {f'accepted_invitations.{username}': [room, opp_color] } })

            # send message to anyone that user has sent invitations letting them know that
            # user is entering a game and is unavailable
            notify_friends('unavailable')

            # send message to the inviter to refresh their page so they can see the accepted invitation
            session['opp_sid'] = opp_sid
            emit('invite_accepted', {'invitee': username}, to=opp_sid)

            # send message back to the player who accepted the invitation to tell them to set up their board
            # and wait for their opponent to join the game
            print('player message sent')
            emit('player', {'username': username, 'opponent': opponent, 'color': color, 'wait_for_opp': True })
        else:
            # if the inviter is online, send a message that their invite has been declined
            # so they can remove the invitation from their "Sent" section
            if opp_sid:
                emit('invite_declined', {'invitee': username}, to=opp_sid)

    def flip_color(color):
        if (color == 'white'):
            return 'black'
        return 'white'


    @socketio.on('cancel_invite')
    def cancel_invite(data):
        username = session.get('username')
        invitee = data['invitee']
        # get the room name
        user = app.db.players.find_one({'username': username})

        # remove invitation from user's array of sent invitations
        app.db.players.update_one({'username': username}, { '$pull': {'sent_invitations': invitee} })

        # remove game from invitee's array of received invitations
        app.db.players.update_one({'username': invitee}, { '$pull': {'received_invitations': username} })

        # if the user is online, send a message that the invitation has been canceled
        opp_sid = get_user_sid(invitee)
        if (opp_sid):
            emit('invitation_canceled', {'inviter': username}, to=opp_sid)
        
        print(f'canceled invitation to {invitee}')

    @socketio.on('cancel_game')
    def cancel_game(data):
        username = session.get('username')
        invitee = data['invitee']
        code = data['code']
        # get the room name
        user = app.db.players.find_one({'username': username})
        room = user['accepted_invitations'][invitee][0]

        # remove game from dict of accepted invitations
        app.db.players.update_one({'username': username}, { '$unset': {f'accepted_invitations.{invitee}': 1 } })

        # send message to the room that the game has been canceled
        emit('opp_disconnect', {'code': code, 'opponent': username}, to=room)
        print(f'canceled game with {invitee}')
        # emit('refresh')

    @socketio.on('cancel_accepted_game')
    def cancel_accepted_game():
        username = session.get('username')
        opp_sid = session.get('opp_sid')
        print(f'opponent sid: {opp_sid}')
        session.pop('opp_sid')
        emit('opp_disconnect', {'code': 'cancel_after_accept', 'opponent': username}, to=opp_sid)

    @socketio.on('game_result')
    def game_result(data):
        if (session.get('username')):
            update_game_log(data['result'], data['my_score'], data['opp_score'])
        else:
            print('User not logged in; game result not logged')

    @socketio.on('computer_move')
    def computer_move():
        emit('computer_move')

    socketio.init_app(app)
    return app

# if __name__=='__main__':
#     # app.run()
#     socketio.run(app)

app=create_app()